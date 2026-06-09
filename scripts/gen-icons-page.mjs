// Generates docs/icons.html — a self-contained reference page mapping every
// app icon (src/lib/icons.ts) to a Font Awesome 7 alternative. Run with:
//   node scripts/gen-icons-page.mjs
// All SVG markup is inlined, so the output has no runtime dependency on the
// Font Awesome assets in /Users/alex/Dev/Fonts.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const FA_ROOT = '/Users/alex/Dev/Fonts/fontawesome-7.2.0/svgs-full';

// --- 1. Parse the app's icon set straight from the source of truth ----------
const iconsSrc = readFileSync(resolve(root, 'src/lib/icons.ts'), 'utf8');
const appIcons = [];
// Match  key: '<svg inner markup>',  (single or double quoted, multiline-safe)
const re = /^\s{4}(\w+):\s*\n?\s*['"]([\s\S]*?)['"],\s*$/gm;
let m;
while ((m = re.exec(iconsSrc)) !== null) {
    appIcons.push({ id: m[1], inner: m[2] });
}
if (!appIcons.length) throw new Error('No icons parsed from src/lib/icons.ts');

// --- 2. Human-readable names + Font Awesome mapping -------------------------
// label: friendly display name. name: the Font Awesome icon, rendered in both
// the primary and secondary weights below — verified to exist under
// svgs-full/{solid,light}/<name>.svg.
const FA_STYLE_1 = 'solid'; // primary weight
const FA_STYLE_2 = 'light'; // "light" weight variant
const META = {
    search: { label: 'Search', name: 'magnifying-glass' },
    repo: { label: 'Repository', name: 'code-branch' },
    chevDown: { label: 'Chevron down', name: 'chevron-down' },
    chevRight: { label: 'Chevron right', name: 'chevron-right' },
    lock: { label: 'Lock', name: 'lock' },
    terminal: { label: 'Terminal', name: 'rectangle-terminal' },
    laptop: { label: 'Laptop', name: 'laptop' },
    folder: { label: 'Folder', name: 'folder' },
    user: { label: 'User', name: 'user' },
    eye: { label: 'Eye', name: 'eye' },
    check: { label: 'Check', name: 'check' },
    alert: { label: 'Alert / warning', name: 'triangle-exclamation' },
    xcircle: { label: 'X in circle', name: 'circle-xmark' },
    circle: { label: 'Circle', name: 'circle' },
    layers: { label: 'Layers', name: 'layer-group' },
    sliders: { label: 'Sliders', name: 'sliders' },
    code: { label: 'Code', name: 'code' },
    db: { label: 'Database', name: 'database' },
    file: { label: 'File', name: 'file' },
    puzzle: { label: 'Puzzle (extension)', name: 'puzzle-piece' },
    grid: { label: 'Grid / dashboard', name: 'grid-2' },
    info: { label: 'Info', name: 'circle-info' },
    grip: { label: 'Grip (drag handle)', name: 'grip-vertical' },
    moon: { label: 'Moon (dark theme)', name: 'moon' },
    sun: { label: 'Sun (light theme)', name: 'sun' },
    panel: { label: 'Panel / inspector', name: 'sidebar-flip' },
    arrow: { label: 'Arrow right', name: 'arrow-right' },
    plus: { label: 'Plus / add', name: 'plus' },
    trash: { label: 'Trash / delete', name: 'trash' },
    compare: { label: 'Compare', name: 'code-compare' },
    eyeoff: { label: 'Eye off / hidden', name: 'eye-slash' },
    play: { label: 'Play / run', name: 'play' },
    diff: { label: 'Diff', name: 'code-merge' },
    settings: { label: 'Settings', name: 'gear' },
    move: { label: 'Move', name: 'up-down-left-right' },
};

// --- 3. Pull each Font Awesome SVG's viewBox + path body --------------------
function loadFa(style, name) {
    const svg = readFileSync(resolve(FA_ROOT, style, `${name}.svg`), 'utf8');
    const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1] ?? '0 0 640 640';
    // Strip the outer <svg> + license comment, keep the inner <path>(s).
    const inner = svg
        .replace(/^[\s\S]*?<svg[^>]*>/, '')
        .replace(/<\/svg>\s*$/, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim();
    return { viewBox, inner };
}

// --- 4. Build the table rows -----------------------------------------------
const SIZE = 22;
const appWrap = (inner) =>
    `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const faWrap = (vb, inner) =>
    `<svg width="${SIZE}" height="${SIZE}" viewBox="${vb}" fill="currentColor">${inner}</svg>`;

// Render one FA weight as a {style pill, icon} pair of cells.
function faCells(style, faName) {
    if (!faName) {
        return `<td class="cell-ic"><span class="missing">—</span></td>`;
    }
    const { viewBox, inner } = loadFa(style, faName);
    return `<td class="cell-ic"><span class="ic fa">${faWrap(viewBox, inner)}</span></td>`;
}

const rows = appIcons
    .map(({ id, inner }) => {
        const meta = META[id] ?? { label: id, name: '' };
        const faName = meta.name;
        const faNameCell = faName
            ? `<code>${faName}</code>`
            : '<span class="missing">no match</span>';
        return `      <tr>
        <td class="name">${meta.label}</td>
        <td><code>${id}</code></td>
        <td class="cell-ic"><span class="ic app">${appWrap(inner)}</span></td>
        <td>${faNameCell}</td>
        ${faCells(FA_STYLE_1, faName)}
        ${faCells(FA_STYLE_2, faName)}
      </tr>`;
    })
    .join('\n');

// --- 5. Emit the page. Tokens mirror src/styles/app.css (light theme) --------
const html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Skillful Claude — Icon Reference</title>
<style>
  :root {
    --bg: #f6f7f9; --surface-1: #ffffff; --surface-2: #f0f2f5; --surface-3: #e7eaee;
    --border: #d8dce2; --fg: #1a1d23; --fg-muted: #5a6270; --fg-dim: #8a929e;
    --accent: #0d9488;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font-family: var(--sans); font-size: 14px; line-height: 1.5;
    -webkit-font-smoothing: antialiased; padding: 40px;
  }
  header { max-width: 980px; margin: 0 auto 28px; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.01em; }
  .sub { color: var(--fg-muted); font-size: 13px; }
  .sub code { color: var(--accent); }
  .wrap { max-width: 980px; margin: 0 auto; }
  table {
    width: 100%; border-collapse: separate; border-spacing: 0;
    background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden;
  }
  thead th {
    text-align: left; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--fg-dim); font-weight: 600;
    padding: 12px 16px; background: var(--surface-2);
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  /* Visually separate the app columns from the Font Awesome columns. */
  thead th:nth-child(4) { border-left: 1px solid var(--border); }
  tbody td:nth-child(4) { border-left: 1px solid var(--border); }
  thead th.group { color: var(--accent); }
  tbody td { padding: 11px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: var(--surface-2); }
  td.name { font-weight: 500; }
  code {
    font-family: var(--mono); font-size: 12px; color: var(--fg-muted);
    background: var(--surface-3); padding: 2px 6px; border-radius: 5px;
  }
  .cell-ic { text-align: center; width: 64px; }
  .ic { display: inline-flex; align-items: center; justify-content: center;
        width: 34px; height: 34px; border-radius: 7px; }
  .ic.app { color: var(--fg); background: var(--surface-3); }
  .ic.fa { color: var(--accent); background: rgba(13,148,136,0.08); }
  .pill {
    font-family: var(--mono); font-size: 11px; color: var(--accent);
    background: rgba(13,148,136,0.1); border: 1px solid rgba(13,148,136,0.28);
    padding: 2px 8px; border-radius: 999px; text-transform: lowercase;
  }
  .missing { color: var(--fg-dim); font-style: italic; }
  footer { max-width: 980px; margin: 22px auto 0; color: var(--fg-dim); font-size: 12px; }
</style>
</head>
<body>
  <header>
    <h1>Skillful Claude — Icon Reference</h1>
    <p class="sub">All ${appIcons.length} icons from <code>src/lib/icons.ts</code>, with a suggested Font Awesome 7 alternative for each.</p>
  </header>
  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>ID</th>
          <th>Icon</th>
          <th class="group">FA name</th>
          <th class="group">Solid</th>
          <th class="group">Light</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>
  <footer>App icons are Lucide-style strokes (24&times;24). Font Awesome glyphs are inlined from fontawesome-7.2.0 (svgs-full). Generated by scripts/gen-icons-page.mjs.</footer>
</body>
</html>
`;

mkdirSync(resolve(root, 'docs'), { recursive: true });
const out = resolve(root, 'docs/icons.html');
writeFileSync(out, html, 'utf8');
console.log(`Wrote ${out} — ${appIcons.length} icons.`);
