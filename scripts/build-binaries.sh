#!/usr/bin/env bash
# Build standalone mip binaries for all supported platforms using bun's
# cross-compilation. Run from the repo root; requires bun and node_modules.
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
mkdir -p dist-bin

build() {
  local target="$1" out="$2"
  echo "Building $out (bun target: $target)..."
  bun build --compile --target="$target" \
    --define __MIP_CLI_VERSION__="\"$VERSION\"" \
    src/cli.ts --outfile "dist-bin/$out"
}

build bun-linux-x64 mip-linux-x64
build bun-linux-arm64 mip-linux-arm64
build bun-darwin-x64 mip-macos-x64
build bun-darwin-arm64 mip-macos-arm64
build bun-windows-x64 mip-windows-x64.exe

ls -la dist-bin/
