# mip-cli

A command-line interface for [mip](https://mip.sh), the MATLAB package
manager — no MATLAB required.

mip-cli runs the *same* mip that is installed for MATLAB. It locates that
installation (see [Configuration](#configuration)) and interprets the mip
MATLAB source with [numbl](https://www.npmjs.com/package/numbl), so the
behavior is identical to running `mip` inside MATLAB, and both share the same
package root, installed packages, pins, and channel subscriptions.

## Install

One line (macOS / Linux — an interactive wizard):

```bash
curl -fsSL https://raw.githubusercontent.com/mip-org/mip-cli/main/install.sh | bash
```

The wizard downloads the standalone binary for your platform (to
`~/.local/bin` by default; override with `MIP_CLI_INSTALL_DIR`), then:

1. looks for MATLAB and asks whether to use it (needed only for
   `mip test`, `mip compile`, and installing mip itself);
2. looks for a mip installation and asks whether to use it — and if MATLAB
   is available but mip is not installed, offers to install mip for you;
3. saves both choices to a config file, so running the CLI never launches
   MATLAB just to find mip.

Every combination works: no MATLAB, MATLAB without mip, or both. Without a
mip installation only `mip help` works; with one, everything except
`test`/`compile` works even with no MATLAB on the machine.

Alternatively, download a standalone binary directly from the
[releases page](https://github.com/mip-org/mip-cli/releases/latest)
(`mip-macos-arm64`, `mip-macos-x64`, `mip-linux-x64`, `mip-linux-arm64`,
`mip-windows-x64.exe`), `chmod +x` it, put it on your `PATH`, and set
`MIP_HOME` (below). No Node.js or other runtime is required.

> macOS note: if you download through a browser, Gatekeeper may quarantine
> the binary ("cannot be opened"). Downloading with `curl` (as the installer
> does) avoids this; otherwise run `xattr -d com.apple.quarantine mip`.

## Configuration

Two locations matter, and they are deliberately distinct:

- **Where mip is installed** (`MIP_HOME`) — used to find the mip code the
  CLI interprets. Resolved from the `MIP_HOME` environment variable,
  falling back to the config file written by the install wizard
  (`~/.config/mip-cli/config.json`). It may point at the mip root
  directory — for a default installation that is `<userpath>/mip`:

  ```bash
  export MIP_HOME="$HOME/Documents/MATLAB/mip"
  ```

- **Which root to operate on** (`MIP_ROOT`) — where packages are listed,
  installed, and uninstalled. By default this is the installation's own
  root; set `MIP_ROOT` to target another root, e.g. an environment. This
  mirrors mip's semantics inside MATLAB, where activating an environment
  sets `MIP_ROOT` — exporting it in your shell is the CLI equivalent of
  `mip activate` (which is why there is no `mip activate` CLI command: a
  program cannot change its shell's environment variables):

  ```bash
  export MIP_ROOT=/path/to/project/.mip
  mip list                    # lists the environment's packages
  unset MIP_ROOT              # leave the environment
  ```

  `MIP_ROOT` is never used to locate the mip code itself.

- **Which MATLAB to launch** (`MIP_MATLAB`) — for the commands that need
  MATLAB. Resolved from the `MIP_MATLAB` environment variable, falling
  back to the wizard-configured MATLAB, then `matlab` on the `PATH`.

Environment variables always override the config file.

## Usage

```bash
mip avail                  # list available packages
mip install chebfun        # install a package
mip list                   # list installed packages
mip info chebfun           # package details
mip update --all           # update everything
mip uninstall chebfun      # uninstall
mip channel add mylab/dev  # manage channels
mip install mip            # install mip itself (uses MATLAB)
mip help [command]         # help
```

Run `mip help` for the full command list.

### Command availability

| Commands | How they run |
|---|---|
| `install`, `update`, `pin`, `unpin`, `uninstall`, `list`, `info`, `avail`, `version`, `channel`, `bundle`, `init`, `help` | Interpreted with numbl — no MATLAB needed |
| `test`, `compile`, `install mip` | Delegated to `matlab -batch` (require MATLAB) |
| `load`, `unload`, `reset` | Not available — they manage the MATLAB session path; run them inside MATLAB |
| `activate`, `deactivate` | Not available — `export MIP_ROOT=...` / `unset MIP_ROOT` instead (see above) |

When delegating to MATLAB, the CLI passes its resolved `MIP_ROOT` into the
session and `addpath`'s the mip source directory itself, so it does not
depend on mip being on that MATLAB's saved path — the configured MATLAB may
be a different version than the one mip was installed from.

`mip install mip` is intercepted when no mip installation exists yet: it
runs the standard mip installer inside MATLAB and records the resulting
location in the config file.

## Development

Requires Node.js >= 18 (and [bun](https://bun.sh) for compiling binaries):

```bash
npm install
npm run build       # bundle src/cli.ts -> dist/cli.js (esbuild)
npm run typecheck   # tsc --noEmit

MIP_HOME="$HOME/Documents/MATLAB/mip" node dist/cli.js list

bash scripts/build-binaries.sh   # standalone binaries for all platforms -> dist-bin/
```

Releases are built by CI: pushing a `v*` tag cross-compiles binaries for all
platforms (via `bun build --compile`) and attaches them to a GitHub release.

### How it works

- [src/cli.ts](src/cli.ts) — argument dispatch and help.
- [src/config.ts](src/config.ts) — the wizard-written config file
  (`mip_home`, `matlab`); environment variables take precedence.
- [src/mip-root.ts](src/mip-root.ts) — resolves the mip installation
  (`MIP_HOME` / config → the directory containing `mip.m`, i.e.
  `<home>/packages/gh/mip-org/core/mip/mip`) and the effective root
  (`MIP_ROOT`, else derived from the installation location — the same
  derivation mip uses).
- [src/run-mip.ts](src/run-mip.ts) — builds a `mip('<command>', ...)` call and
  executes it with numbl's `executeCode`, with the mip source directory on the
  numbl search path and `MIP_ROOT` pinned to the resolved root.
- [src/matlab-batch.ts](src/matlab-batch.ts) — runs `test`/`compile` via
  `matlab -batch`, prefixing the expression with `setenv('MIP_ROOT', ...)`
  and `addpath(...)`.
- [src/bootstrap.ts](src/bootstrap.ts) — the `mip install mip`
  interception: runs `eval(webread('https://mip.sh/install.txt'))` in
  MATLAB, then saves `mip_home`.
- Filesystem/env access inside the interpreter uses the `NodeFileIOAdapter` /
  `NodeSystemAdapter` / `scanMFiles` exported from `numbl/node`
  (requires numbl >= 0.4.13).

Note: numbl's own CLI bundles a copy of mip for its internal use; mip-cli does
not use it. It embeds the numbl *library*, which adds no search paths of its
own, so only the configured installation is ever consulted.

## Known limitations

- `mip bundle` requires numbl >= 0.4.13 (cell-array `reshape`, `zip`,
  datetime `Format` support, and recursive `dir` glob filtering were added
  there for this command).
