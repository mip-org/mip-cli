#!/usr/bin/env bash
# mip-cli installer: downloads the standalone mip binary for this platform
# from the latest GitHub release.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mip-org/mip-cli/main/install.sh | bash
#
# Installs to ~/.local/bin/mip by default; override with MIP_CLI_INSTALL_DIR.
set -euo pipefail

REPO="mip-org/mip-cli"

case "$(uname -s)" in
  Darwin) os="macos" ;;
  Linux) os="linux" ;;
  *)
    echo "Unsupported OS: $(uname -s)" >&2
    echo "Download a binary manually from https://github.com/$REPO/releases" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  arm64 | aarch64) arch="arm64" ;;
  x86_64 | amd64) arch="x64" ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

asset="mip-${os}-${arch}"
dest_dir="${MIP_CLI_INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$dest_dir"

echo "Downloading $asset..."
curl -fL --progress-bar \
  "https://github.com/$REPO/releases/latest/download/$asset" \
  -o "$dest_dir/mip"
chmod +x "$dest_dir/mip"

echo "Installed mip to $dest_dir/mip"

case ":$PATH:" in
  *":$dest_dir:"*) ;;
  *)
    echo ""
    echo "Note: $dest_dir is not on your PATH. Add this to your shell profile:"
    echo "  export PATH=\"$dest_dir:\$PATH\""
    ;;
esac

echo ""
echo "Next, point mip at your MATLAB mip installation, e.g.:"
echo "  export MIP_ROOT=\"\$HOME/Documents/MATLAB/mip\""
echo "Then try:  mip help"
