#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
RELEASES_DIR="$PROJECT_ROOT/releases"
TAURI_DIR="$PROJECT_ROOT/src-tauri"

# Read version from tauri.conf.json
VERSION=$(grep -o '"version": *"[^"]*"' "$TAURI_DIR/tauri.conf.json" | head -1 | grep -o '"[^"]*"$' | tr -d '"')
echo "Building SpriteChat v${VERSION}"

# Step 1: Build the web UI
echo ""
echo "=== Building web UI ==="
cd "$PROJECT_ROOT"
npm run build

# Step 2: Build the Tauri app (bundle each target separately to avoid "Text file busy" error)
echo ""
echo "=== Building Tauri desktop app ==="
cd "$PROJECT_ROOT"
for bundle_target in deb rpm appimage; do
    echo "--- Bundling: $bundle_target ---"
    env -u GTK_PATH -u GIO_MODULE_DIR npx tauri build --bundles "$bundle_target"
done

# Step 3: Collect binaries into releases/
echo ""
echo "=== Collecting release artifacts ==="
rm -rf "$RELEASES_DIR"
mkdir -p "$RELEASES_DIR"

# Find the target triple (e.g. x86_64-unknown-linux-gnu)
BUNDLE_BASE=$(find "$TAURI_DIR/target" -maxdepth 3 -path "*/release/bundle" -type d 2>/dev/null | head -1)

if [ -z "$BUNDLE_BASE" ]; then
    echo "Error: Could not find bundle output directory"
    exit 1
fi

RELEASE_DIR=$(dirname "$BUNDLE_BASE")

# Copy the raw binary
if [ -f "$RELEASE_DIR/spritechat" ]; then
    cp "$RELEASE_DIR/spritechat" "$RELEASES_DIR/"
    echo "  Copied: spritechat"
fi

# Copy .deb package(s)
for f in "$BUNDLE_BASE"/deb/*.deb; do
    [ -f "$f" ] && cp "$f" "$RELEASES_DIR/" && echo "  Copied: $(basename "$f")"
done

# Copy .AppImage(s)
for f in "$BUNDLE_BASE"/appimage/*.AppImage; do
    [ -f "$f" ] && cp "$f" "$RELEASES_DIR/" && echo "  Copied: $(basename "$f")"
done

# Copy .rpm package(s)
for f in "$BUNDLE_BASE"/rpm/*.rpm; do
    [ -f "$f" ] && cp "$f" "$RELEASES_DIR/" && echo "  Copied: $(basename "$f")"
done

# Copy .dmg (macOS)
for f in "$BUNDLE_BASE"/dmg/*.dmg; do
    [ -f "$f" ] && cp "$f" "$RELEASES_DIR/" && echo "  Copied: $(basename "$f")"
done

# Copy .app bundle (macOS)
for f in "$BUNDLE_BASE"/macos/*.app; do
    [ -d "$f" ] && cp -r "$f" "$RELEASES_DIR/" && echo "  Copied: $(basename "$f")"
done

# Copy .msi / .exe (Windows)
for f in "$BUNDLE_BASE"/msi/*.msi; do
    [ -f "$f" ] && cp "$f" "$RELEASES_DIR/" && echo "  Copied: $(basename "$f")"
done
for f in "$BUNDLE_BASE"/nsis/*.exe; do
    [ -f "$f" ] && cp "$f" "$RELEASES_DIR/" && echo "  Copied: $(basename "$f")"
done

echo ""
echo "=== Build complete ==="
echo "Release artifacts in: $RELEASES_DIR/"
ls -lh "$RELEASES_DIR/"
