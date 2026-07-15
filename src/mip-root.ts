/**
 * Resolution of the two locations mip-cli cares about. They are distinct
 * on purpose:
 *
 *   - The mip HOME: where the mip *installation* lives — used only to
 *     locate mip.m (the code the CLI interprets). Resolved from the
 *     MIP_HOME environment variable, falling back to the mip_home value
 *     the install wizard saved in the config file. MIP_HOME may point at
 *     the mip source directory itself or at any of the standard ancestor
 *     directories (e.g. the mip root); mip.m is found from there.
 *
 *   - The mip ROOT: where packages are installed — the directory
 *     containing packages/. This is mip's own MIP_ROOT semantics: setting
 *     MIP_ROOT in the shell targets a different root (e.g. an
 *     environment), exactly as setenv('MIP_ROOT', ...) does inside
 *     MATLAB. When MIP_ROOT is unset, the root is derived from the mip
 *     installation's own location, as mip itself does.
 *
 * MIP_ROOT is never used to locate mip.m — otherwise pointing MIP_ROOT at
 * an environment (which does not contain a mip installation) would break
 * the CLI itself.
 */

import { existsSync, statSync } from "fs";
import { dirname, join } from "path";
import { readConfig, configFilePath } from "./config.js";

/** An error whose message should be shown to the user as-is (no stack). */
export class MipCliError extends Error {}

const MIP_HOME_INSTRUCTIONS = `cannot locate a mip installation.

mip-cli interprets the mip that is installed for MATLAB, so it needs to
know where that installation lives. Either re-run the install wizard:

  curl -fsSL https://raw.githubusercontent.com/mip-org/mip-cli/main/install.sh | bash

or set the MIP_HOME environment variable to your mip directory (for a
default installation this is <userpath>/mip), e.g.:

  export MIP_HOME="$HOME/Documents/MATLAB/mip"

If mip is not installed yet, run 'mip install mip' (requires MATLAB), or
install it from within MATLAB:

  eval(webread('https://mip.sh/install.txt'))`;

/** Relative path from a mip root to the directory containing mip.m. */
const SOURCE_DIR_FROM_ROOT = ["packages", "gh", "mip-org", "core", "mip", "mip"];

function isDir(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory();
}

/**
 * The configured mip home (MIP_HOME env var, else the wizard-written
 * config), or undefined if neither is set. No validation.
 */
export function configuredMipHome(): string | undefined {
  return process.env.MIP_HOME || readConfig().mip_home || undefined;
}

/**
 * Directory containing mip.m and +mip/ — the code the CLI interprets.
 *
 * MIP_HOME (or the config's mip_home) may point at the source directory
 * itself, at a mip root (the directory containing packages/), or at the
 * installed package directory; mip.m is resolved from any of them.
 */
export function resolveMipSourceDir(): string {
  const home = configuredMipHome();
  if (!home) {
    throw new MipCliError(MIP_HOME_INSTRUCTIONS);
  }
  if (!isDir(home)) {
    throw new MipCliError(
      `MIP_HOME is set to '${home}' (via ${
        process.env.MIP_HOME ? "the MIP_HOME environment variable" : configFilePath()
      }), but that directory does not exist.`
    );
  }
  const candidates = [
    home, // the source directory itself (contains mip.m)
    join(home, ...SOURCE_DIR_FROM_ROOT), // a mip root
    join(home, "mip"), // the installed package directory (.../core/mip)
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "mip.m"))) return dir;
  }
  throw new MipCliError(
    `no mip installation found under '${home}' (via ${
      process.env.MIP_HOME ? "the MIP_HOME environment variable" : configFilePath()
    }): expected mip.m in that directory or at ${join(home, ...SOURCE_DIR_FROM_ROOT)}.

If mip is not installed yet, run 'mip install mip' (requires MATLAB), or
install it from within MATLAB:

  eval(webread('https://mip.sh/install.txt'))`
  );
}

/**
 * The mip root the current command operates on: MIP_ROOT if set (the
 * shell-side way to target an environment or any other root), otherwise
 * the root the mip installation itself lives in.
 */
export function resolveEffectiveRoot(mipSourceDir: string): string {
  const envRoot = process.env.MIP_ROOT;
  if (envRoot) {
    if (!isDir(envRoot)) {
      throw new MipCliError(
        `MIP_ROOT is set to '${envRoot}', but that directory does not exist.`
      );
    }
    if (!existsSync(join(envRoot, "packages"))) {
      throw new MipCliError(
        `MIP_ROOT is set to '${envRoot}', but that directory does not contain a packages/ subdirectory, so it does not look like a mip root.`
      );
    }
    return envRoot;
  }
  // Derive the root from the installation location, mirroring mip's own
  // mip.paths.derived_root: <root>/packages/gh/mip-org/core/mip/mip
  let root = mipSourceDir;
  for (let i = 0; i < SOURCE_DIR_FROM_ROOT.length; i++) root = dirname(root);
  if (
    join(root, ...SOURCE_DIR_FROM_ROOT) === mipSourceDir &&
    existsSync(join(root, "packages"))
  ) {
    return root;
  }
  throw new MipCliError(
    `cannot determine the mip root: the mip installation at '${mipSourceDir}' is not inside a standard mip root layout.

Set the MIP_ROOT environment variable to the root directory (the one
containing packages/) you want to operate on, e.g.:

  export MIP_ROOT="$HOME/Documents/MATLAB/mip"`
  );
}
