#!/usr/bin/env node
/**
 * mip-cli — run mip, the MATLAB package manager, from the command line
 * without MATLAB.
 *
 * Most commands are executed by interpreting the MATLAB-installed mip source
 * (located via MIP_ROOT) with numbl. `test` and `compile` need a real MATLAB
 * and are delegated to `matlab -batch`. `load`/`unload`/`reset` manage the
 * MATLAB session path and are not available from the command line.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import { runMipCommand } from "./run-mip.js";
import { runMatlabBatch } from "./matlab-batch.js";
import { MipCliError, resolveMipSourceDir } from "./mip-root.js";

/** Version string injected at build time (bun build --define); falls back
 *  to reading package.json when running from a normal checkout. */
declare const __MIP_CLI_VERSION__: string | undefined;

const NUMBL_COMMANDS = new Set([
  "install",
  "update",
  "pin",
  "unpin",
  "uninstall",
  "list",
  "info",
  "avail",
  "version",
  "channel",
  "bundle",
  "init",
]);

const MATLAB_COMMANDS = new Set(["test", "compile"]);

const SESSION_COMMANDS = new Set(["load", "unload", "reset"]);

const HELP_TEXT = `mip — a package manager for MATLAB/MEX (command-line interface)

Usage:
  mip install <package> [...]                     - Install one or more packages
  mip install --channel <owner>/<channel> <pkg>   - Install from a user-hosted channel
  mip install <owner>/<channel>/<package>         - Install using fully qualified name
  mip update <package> [...]                      - Update one or more packages
  mip update --force <package>                    - Force update even if up to date
  mip update --deps <package>                     - Update package and its dependencies
  mip update --all                                - Update all installed packages
  mip update mip                                  - Update mip itself
  mip pin <package> [...]                         - Pin packages to their current version
  mip unpin <package> [...]                       - Unpin packages
  mip uninstall <package> [...]                   - Uninstall one or more packages
  mip list                                        - List installed packages
  mip list --sort-by-name                         - List installed packages (alphabetical)
  mip info                                        - Display info about mip itself
  mip info <package>                              - Display package information
  mip avail                                       - List available packages in repository
  mip avail --channel <owner>/<channel>           - List packages from a specific channel
  mip version                                     - Display mip version
  mip test <package>                              - Run package test script (uses MATLAB)
  mip compile <package>                           - Compile/recompile MEX files (uses MATLAB)
  mip bundle <directory> [--output <dir>]         - Build .mhl from local package
  mip init <directory> [--name <name>]            - Generate a starter mip.yaml
  mip channel add <channel>                       - Subscribe at highest priority
  mip channel append <channel>                    - Subscribe at lowest priority
  mip channel remove <channel>                    - Unsubscribe from a channel
  mip channel list                                - List channels in priority order
  mip help [command]                              - Show help text for command

The MIP_ROOT environment variable must point to your mip root directory
(the one containing packages/), e.g. $HOME/Documents/MATLAB/mip.

Commands run against the mip installed for MATLAB, interpreted with numbl —
no MATLAB required, except for 'test' and 'compile', which run via
'matlab -batch'. 'load', 'unload', and 'reset' manage the MATLAB session
path and are only available inside MATLAB.
`;

function cliVersion(): string {
  if (typeof __MIP_CLI_VERSION__ === "string") return __MIP_CLI_VERSION__;
  try {
    const require = createRequire(import.meta.url);
    return require("../package.json").version as string;
  } catch {
    return "unknown";
  }
}

/**
 * Print the help comment block of +mip/<command>.m, mirroring what
 * `mip help <command>` shows in MATLAB.
 */
function printCommandHelp(command: string): number {
  if (SESSION_COMMANDS.has(command)) {
    process.stderr.write(
      `'mip ${command}' manages the MATLAB session path and is not available from the command line. Run it inside MATLAB.\n`
    );
    return 1;
  }
  if (!NUMBL_COMMANDS.has(command) && !MATLAB_COMMANDS.has(command)) {
    process.stderr.write(`Unknown mip command '${command}'.\n`);
    return 1;
  }
  const mipSourceDir = resolveMipSourceDir();
  const file = join(mipSourceDir, "+mip", command.replace(/-/g, "_") + ".m");
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    process.stderr.write(`No help found for 'mip ${command}'.\n`);
    return 1;
  }
  // Print the first contiguous comment block after the function line(s),
  // the same block MATLAB's help command shows.
  const lines = source.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim().startsWith("%")) i++;
  const helpLines: string[] = [];
  while (i < lines.length && lines[i].trim().startsWith("%")) {
    helpLines.push(lines[i].trim().replace(/^%[ ]?/, ""));
    i++;
  }
  if (helpLines.length === 0) {
    process.stderr.write(`No help found for 'mip ${command}'.\n`);
    return 1;
  }
  process.stdout.write(helpLines.join("\n") + "\n");
  return 0;
}

function main(): number {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (argv[0] === "--version") {
    process.stdout.write(`mip-cli ${cliVersion()}\n`);
    return 0;
  }

  const command = argv[0].toLowerCase();
  const args = argv.slice(1);

  if (command === "help") {
    if (args.length === 0) {
      process.stdout.write(HELP_TEXT);
      return 0;
    }
    return printCommandHelp(args[0].toLowerCase());
  }

  if (SESSION_COMMANDS.has(command)) {
    process.stderr.write(
      `'mip ${command}' manages the MATLAB session path and is not available from the command line. Run it inside MATLAB.\n`
    );
    return 1;
  }

  if (MATLAB_COMMANDS.has(command)) {
    return runMatlabBatch(command, args);
  }

  if (!NUMBL_COMMANDS.has(command)) {
    process.stderr.write(
      `Unknown command '${command}'. Run 'mip help' for usage information.\n`
    );
    return 1;
  }

  return runMipCommand(command, args);
}

function cliMain(): void {
  try {
    process.exit(main());
  } catch (err) {
    if (err instanceof MipCliError) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
}

// numbl's NodeFileIOAdapter implements synchronous webread/websave by
// spawning `process.execPath -e <script>`. In a compiled standalone binary,
// process.execPath is this binary itself, so emulate `node -e` here. The
// scripts numbl generates only use fetch, fs, and process.
if (process.argv[2] === "-e" && typeof process.argv[3] === "string") {
  const evalRequire = createRequire(import.meta.url);
  new Function("require", process.argv[3])(evalRequire);
  // The script's async work (fetch) keeps the process alive; do not fall
  // through to the CLI. Exit code is set by the script itself on failure.
} else {
  cliMain();
}
