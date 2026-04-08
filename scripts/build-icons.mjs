#!/usr/bin/env node
//
// Generates all the platform-specific app icons electron-builder needs
// from a single SVG source at design/icon-source.svg.
//
// Pipeline:
//
//   1. Render the SVG to a 1024×1024 PNG at build/icon.png. This is the
//      master source — both for electron-icon-builder and as the file
//      Linux uses directly.
//   2. Run electron-icon-builder against build/icon.png to produce
//      build/icons/png/*.png (multiple sizes), build/icons/mac/icon.icns,
//      and build/icons/win/icon.ico.
//   3. Copy the .icns and .ico into build/ at the paths electron-builder
//      reads (build/icon.icns, build/icon.ico) and flatten the Linux
//      PNGs into build/icons/ so the rpm/deb/AppImage targets find them.
//
// To regenerate after editing design/icon-source.svg:
//
//   npm run icons
//
// Replace design/icon-source.svg with real artwork to ship a polished
// icon — nothing in this script is brand-specific, it just renders
// whatever vector source it finds.

import { mkdir, copyFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SVG_SOURCE = join(ROOT, "design", "icon-source.svg");
const BUILD_DIR = join(ROOT, "build");
const MASTER_PNG = join(BUILD_DIR, "icon.png");
const ICON_BUILDER_OUT = join(BUILD_DIR, "_iconbuilder");

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function main() {
  if (!existsSync(SVG_SOURCE)) {
    console.error(`✗ missing icon source: ${SVG_SOURCE}`);
    process.exit(1);
  }

  console.log(`▸ rendering ${SVG_SOURCE} → ${MASTER_PNG}`);
  await ensureDir(BUILD_DIR);
  await sharp(SVG_SOURCE)
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(MASTER_PNG);

  // electron-icon-builder takes a single PNG and emits the platform-
  // specific bundles into --output. We point it at a scratch dir under
  // build/ and then promote the files we want.
  console.log("▸ running electron-icon-builder");
  await rm(ICON_BUILDER_OUT, { recursive: true, force: true });
  const result = spawnSync(
    process.execPath,
    [
      join(ROOT, "node_modules", "electron-icon-builder", "index.js"),
      `--input=${MASTER_PNG}`,
      `--output=${ICON_BUILDER_OUT}`,
      "--flatten",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error("✗ electron-icon-builder failed");
    process.exit(result.status ?? 1);
  }

  // electron-icon-builder (with --flatten) writes everything into a
  // single <output>/icons/ directory:
  //   icons/icon.icns
  //   icons/icon.ico
  //   icons/<size>x<size>.png   (16,24,32,48,64,128,256,512,1024)
  // We promote those to where electron-builder.yml expects them:
  //   build/icon.icns       (macOS)
  //   build/icon.ico        (Windows)
  //   build/icons/<size>x<size>.png  (Linux)
  const generatedRoot = join(ICON_BUILDER_OUT, "icons");
  const macIcns = join(generatedRoot, "icon.icns");
  const winIco = join(generatedRoot, "icon.ico");

  if (existsSync(macIcns)) {
    await copyFile(macIcns, join(BUILD_DIR, "icon.icns"));
    console.log("▸ wrote build/icon.icns");
  } else {
    console.warn(`! missing ${macIcns}`);
  }
  if (existsSync(winIco)) {
    await copyFile(winIco, join(BUILD_DIR, "icon.ico"));
    console.log("▸ wrote build/icon.ico");
  } else {
    console.warn(`! missing ${winIco}`);
  }

  if (existsSync(generatedRoot)) {
    const linuxOut = join(BUILD_DIR, "icons");
    await rm(linuxOut, { recursive: true, force: true });
    await ensureDir(linuxOut);
    const allFiles = await readdir(generatedRoot);
    const pngs = allFiles.filter((f) => /^\d+x\d+\.png$/.test(f));
    for (const f of pngs) {
      await copyFile(join(generatedRoot, f), join(linuxOut, f));
    }
    console.log(`▸ wrote ${pngs.length} PNGs to build/icons/`);
  }

  // Drop the scratch dir so build/ stays clean.
  await rm(ICON_BUILDER_OUT, { recursive: true, force: true });

  console.log("✓ icons regenerated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
