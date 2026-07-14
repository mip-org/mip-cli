# mip-cli

A command-line interface for [mip](https://mip.sh), the MATLAB package
manager — no MATLAB required.

mip-cli runs the *same* mip that is installed for MATLAB. It locates your
mip installation via the `MIP_ROOT` environment variable and interprets the
mip MATLAB source with [numbl](https://www.npmjs.com/package/numbl), so the
behavior is identical to running `mip` inside MATLAB, and both share the same
package root, installed packages, pins, and channel subscriptions.

## Requirements

- A mip installation (created from within MATLAB via
  `eval(webread('https://mip.sh/install.txt'))`)
- MATLAB itself is only needed for `mip test` and `mip compile`

## Install

One line (macOS / Linux — detects your platform, installs to `~/.local/bin`):

```bash
curl -fsSL https://raw.githubusercontent.com/mip-org/mip-cli/main/install.sh | bash
```

Or download a standalone binary directly from the
[releases page](https://github.com/mip-org/mip-cli/releases/latest)
(`mip-macos-arm64`, `mip-macos-x64`, `mip-linux-x64`, `mip-linux-arm64`,
`mip-windows-x64.exe`), then `chmod +x` it and put it on your `PATH`.
No Node.js or other runtime is required.

> macOS note: if you download through a browser, Gatekeeper may quarantine
> the binary ("cannot be opened"). Downloading with `curl` (as the installer
> does) avoids this; otherwise run `xattr -d com.apple.quarantine mip`.

Then point mip at your mip root — the directory containing `packages/`.
For a default installation this is `<userpath>/mip`:

```bash
export MIP_ROOT="$HOME/Documents/MATLAB/mip"
```

## Usage

```bash
mip avail                  # list available packages
mip install chebfun        # install a package
mip list                   # list installed packages
mip info chebfun           # package details
mip update --all           # update everything
mip uninstall chebfun      # uninstall
mip channel add mylab/dev  # manage channels
mip help [command]         # help
```

Run `mip help` for the full command list.

### Command availability

| Commands | How they run |
|---|---|
| `install`, `update`, `pin`, `unpin`, `uninstall`, `list`, `info`, `avail`, `version`, `channel`, `bundle`, `init`, `help` | Interpreted with numbl — no MATLAB needed |
| `test`, `compile` | Delegated to `matlab -batch` (require MATLAB on the PATH) |
| `load`, `unload`, `reset` | Not available — they manage the MATLAB session path; run them inside MATLAB |

## Development

Requires Node.js >= 18 (and [bun](https://bun.sh) for compiling binaries):

```bash
npm install
npm run build       # bundle src/cli.ts -> dist/cli.js (esbuild)
npm run typecheck   # tsc --noEmit

MIP_ROOT="$HOME/Documents/MATLAB/mip" node dist/cli.js list

bash scripts/build-binaries.sh   # standalone binaries for all platforms -> dist-bin/
```

Releases are built by CI: pushing a `v*` tag cross-compiles binaries for all
platforms (via `bun build --compile`) and attaches them to a GitHub release.

### How it works

- [src/cli.ts](src/cli.ts) — argument dispatch and help.
- [src/mip-root.ts](src/mip-root.ts) — resolves `MIP_ROOT` and the mip source
  directory (`<root>/packages/gh/mip-org/core/mip/mip`, the same directory
  that is on the MATLAB path).
- [src/run-mip.ts](src/run-mip.ts) — builds a `mip('<command>', ...)` call and
  executes it with numbl's `executeCode`, with the mip source directory on the
  numbl search path. mip itself picks up `MIP_ROOT` through `getenv`, so it
  operates on the same root.
- [src/matlab-batch.ts](src/matlab-batch.ts) — runs `test`/`compile` via
  `matlab -batch`.
- Filesystem/env access inside the interpreter uses the `NodeFileIOAdapter` /
  `NodeSystemAdapter` / `scanMFiles` exported from `numbl/node`
  (requires numbl >= 0.4.13).

Note: numbl's own CLI bundles a copy of mip for its internal use; mip-cli does
not use it. It embeds the numbl *library*, which adds no search paths of its
own, so only the `MIP_ROOT` installation is ever consulted.

## Known limitations

- `mip bundle` requires numbl >= 0.4.13 (cell-array `reshape`, `zip`,
  datetime `Format` support, and recursive `dir` glob filtering were added
  there for this command).
