#!/usr/bin/env bash
# mip-cli installer: an interactive wizard that downloads the standalone
# mip binary for this platform and configures it.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mip-org/mip-cli/main/install.sh | bash
#
# The wizard:
#   1. installs the mip binary (to ~/.local/bin by default; override with
#      MIP_CLI_INSTALL_DIR)
#   2. looks for MATLAB and asks whether to use it (for 'mip test',
#      'mip compile', and installing mip itself)
#   3. looks for a mip installation and asks whether to use it; if MATLAB
#      is available and mip is not installed, offers to install it
#   4. saves both choices to the mip-cli config file, so running the CLI
#      never needs to launch MATLAB just to find mip
#
# Everything the wizard saves can be overridden per-shell with environment
# variables: MIP_HOME (the mip installation), MIP_MATLAB (the MATLAB
# executable), MIP_ROOT (the root to operate on, e.g. an environment).
#
# When run without a terminal (e.g. in CI), the wizard accepts what it
# detects and never launches MATLAB.
set -euo pipefail

REPO="mip-org/mip-cli"
MIP_INSTALL_URL="https://mip.sh/install.txt"

# ---------------------------------------------------------------- helpers

interactive=false
if [ -e /dev/tty ] && (: < /dev/tty) 2>/dev/null; then
  interactive=true
fi

# ask "question" default(y|n) -> returns 0 for yes
ask() {
  local question="$1" default="$2" reply
  if ! $interactive; then
    echo "$question -> $default (non-interactive)"
    [ "$default" = "y" ]
    return
  fi
  local hint="[Y/n]"
  [ "$default" = "n" ] && hint="[y/N]"
  printf "%s %s " "$question" "$hint" > /dev/tty
  read -r reply < /dev/tty || reply=""
  reply="${reply:-$default}"
  case "$reply" in
    y | Y | yes | Yes | YES) return 0 ;;
    *) return 1 ;;
  esac
}

# ask_path "prompt" -> prints the entered path (may be empty)
ask_path() {
  local prompt="$1" reply=""
  if $interactive; then
    printf "%s " "$prompt" > /dev/tty
    read -r reply < /dev/tty || reply=""
  fi
  printf "%s" "$reply"
}

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

is_mip_home() {
  [ -n "$1" ] && [ -f "$1/packages/gh/mip-org/core/mip/mip/mip.m" ]
}

# ------------------------------------------------- 1. install the binary

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
echo ""

# ------------------------------------------------------ 2. find a MATLAB

matlab_exe=""
matlab_candidates=()
if command -v matlab > /dev/null 2>&1; then
  matlab_candidates+=("$(command -v matlab)")
fi
for glob in \
  /usr/local/MATLAB/R*/bin/matlab \
  "$HOME"/MATLAB/R*/bin/matlab \
  /Applications/MATLAB_R*.app/bin/matlab; do
  [ -x "$glob" ] && matlab_candidates+=("$glob")
done

for candidate in ${matlab_candidates[0]+"${matlab_candidates[@]}"}; do
  if ask "Found MATLAB at $candidate. Use this MATLAB?" y; then
    matlab_exe="$candidate"
    break
  fi
done

if [ -z "$matlab_exe" ] && $interactive; then
  entered=$(ask_path "Path to a MATLAB executable to use (leave empty for none):")
  if [ -n "$entered" ]; then
    if [ -x "$entered" ]; then
      matlab_exe="$entered"
    else
      echo "Note: '$entered' is not an executable file; continuing without MATLAB."
    fi
  fi
fi

if [ -n "$matlab_exe" ]; then
  echo "Using MATLAB: $matlab_exe"
else
  echo "No MATLAB configured. 'mip test', 'mip compile', and 'mip install mip'"
  echo "will not be available; everything else works without MATLAB."
fi
echo ""

# ------------------------------------------ 3. find (or install) mip

mip_home=""

# The default installation location is <userpath>/mip.
default_home="$HOME/Documents/MATLAB/mip"
if is_mip_home "$default_home"; then
  if ask "Found a mip installation at $default_home. Use this mip?" y; then
    mip_home="$default_home"
  fi
fi

if [ -z "$mip_home" ] && [ -n "$matlab_exe" ] && $interactive; then
  # Not at the default location: MATLAB knows its userpath, which is where
  # a standard installation lives.
  echo "Checking MATLAB's userpath for a mip installation (this may take a moment)..."
  matlab_userpath=$("$matlab_exe" -batch "disp(userpath)" 2> /dev/null | tail -n 1 | tr -d '\r') || matlab_userpath=""
  if [ -n "$matlab_userpath" ] && [ "$matlab_userpath/mip" != "$default_home" ] \
    && is_mip_home "$matlab_userpath/mip"; then
    if ask "Found a mip installation at $matlab_userpath/mip. Use this mip?" y; then
      mip_home="$matlab_userpath/mip"
    fi
  fi
fi

if [ -z "$mip_home" ] && $interactive; then
  entered=$(ask_path "Path to an existing mip installation (leave empty for none):")
  if [ -n "$entered" ]; then
    if is_mip_home "$entered"; then
      mip_home="$entered"
    else
      echo "Note: '$entered' does not look like a mip installation (expected"
      echo "packages/gh/mip-org/core/mip/mip/mip.m under it); continuing without it."
    fi
  fi
fi

if [ -z "$mip_home" ] && [ -n "$matlab_exe" ] && $interactive; then
  if ask "mip is not installed. Install it now via MATLAB?" y; then
    echo "Running the mip installer in MATLAB..."
    "$matlab_exe" -batch "eval(webread('$MIP_INSTALL_URL'))" < /dev/tty || true
    # Detect whether the installer actually completed (it may have been
    # aborted or failed).
    matlab_userpath=$("$matlab_exe" -batch "disp(userpath)" 2> /dev/null | tail -n 1 | tr -d '\r') || matlab_userpath=""
    if [ -n "$matlab_userpath" ] && is_mip_home "$matlab_userpath/mip"; then
      mip_home="$matlab_userpath/mip"
      echo "mip was installed at $mip_home."
    elif is_mip_home "$default_home"; then
      mip_home="$default_home"
      echo "mip was installed at $mip_home."
    else
      echo "mip was not installed; continuing without it."
    fi
  fi
fi

if [ -n "$mip_home" ]; then
  echo "Using mip installation: $mip_home"
else
  echo ""
  echo "No mip installation configured. Only 'mip help' will work until one is."
  if [ -n "$matlab_exe" ]; then
    echo "Install mip later with:  mip install mip"
  else
    echo "Install mip from within MATLAB with:"
    echo "  eval(webread('$MIP_INSTALL_URL'))"
    echo "then set MIP_HOME or re-run this wizard."
  fi
fi
echo ""

# --------------------------------------------------- 4. save the config

config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/mip-cli"
config_file="$config_dir/config.json"
mkdir -p "$config_dir"
{
  echo "{"
  sep=""
  if [ -n "$mip_home" ]; then
    printf '  "mip_home": "%s"' "$(json_escape "$mip_home")"
    sep=","
  fi
  if [ -n "$matlab_exe" ]; then
    printf '%s\n  "matlab": "%s"' "$sep" "$(json_escape "$matlab_exe")"
  fi
  echo ""
  echo "}"
} > "$config_file"
echo "Saved configuration to $config_file"

case ":$PATH:" in
  *":$dest_dir:"*) ;;
  *)
    echo ""
    echo "Note: $dest_dir is not on your PATH. Add this to your shell profile:"
    echo "  export PATH=\"$dest_dir:\$PATH\""
    ;;
esac

echo ""
echo "Done. Try:  mip help"
