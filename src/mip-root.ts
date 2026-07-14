/**
 * Resolution of the mip root directory.
 *
 * mip-cli runs the same mip that is installed for MATLAB, so it needs the
 * mip root (the directory containing packages/). The MIP_ROOT environment
 * variable is required — mip itself honors the same variable (see
 * +mip/+paths/root.m in the mip source), so both MATLAB and mip-cli end up
 * operating on the same installation.
 */

import { existsSync, statSync } from "fs";
import { join } from "path";

/** An error whose message should be shown to the user as-is (no stack). */
export class MipCliError extends Error {}

const MIP_ROOT_INSTRUCTIONS = `the MIP_ROOT environment variable is not set.

mip-cli operates on the mip installation that MATLAB uses, so it needs to
know your mip root directory — the directory containing the packages/
subdirectory. For a default installation this is <userpath>/mip, e.g.:

  export MIP_ROOT="$HOME/Documents/MATLAB/mip"

If mip is not installed yet, install it from within MATLAB:

  eval(webread('https://mip.sh/install.txt'))`;

export function resolveMipRoot(): string {
  const root = process.env.MIP_ROOT;
  if (!root) {
    throw new MipCliError(MIP_ROOT_INSTRUCTIONS);
  }
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new MipCliError(
      `MIP_ROOT is set to '${root}', but that directory does not exist.`
    );
  }
  if (!existsSync(join(root, "packages"))) {
    throw new MipCliError(
      `MIP_ROOT is set to '${root}', but that directory does not contain a packages/ subdirectory, so it does not look like a mip root.`
    );
  }
  return root;
}

/**
 * Directory containing mip.m and +mip/ — the same directory that is on the
 * MATLAB path in a standard installation:
 * <root>/packages/gh/mip-org/core/mip/mip
 */
export function resolveMipSourceDir(): string {
  const root = resolveMipRoot();
  const sourceDir = join(
    root,
    "packages",
    "gh",
    "mip-org",
    "core",
    "mip",
    "mip"
  );
  if (!existsSync(join(sourceDir, "mip.m"))) {
    throw new MipCliError(
      `mip does not appear to be installed under MIP_ROOT ('${root}'): expected to find ${join(sourceDir, "mip.m")}.

Install mip from within MATLAB:

  eval(webread('https://mip.sh/install.txt'))`
    );
  }
  return sourceDir;
}
