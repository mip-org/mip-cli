/**
 * Bootstrap-install mip itself via MATLAB.
 *
 * `mip install mip` from the CLI cannot be interpreted with numbl when mip
 * is not installed yet — there is no mip source to interpret. It is
 * intercepted and handled here instead: run the standard mip installer
 * inside MATLAB (the same eval(webread(...)) a user would run at the
 * MATLAB prompt), then record where the installation landed so subsequent
 * CLI commands find it.
 */

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { readConfig, writeConfig, configFilePath } from "./config.js";
import { matlabQuote, resolveMatlabExecutable } from "./matlab.js";
import { configuredMipHome } from "./mip-root.js";

const INSTALL_URL = "https://mip.sh/install.txt";

/** <userpath>/mip as reported by this MATLAB, or undefined on failure. */
function defaultMipHome(matlab: string): string | undefined {
  const result = spawnSync(matlab, ["-batch", "disp(userpath)"], {
    encoding: "utf-8",
  });
  if (result.status !== 0 || !result.stdout) return undefined;
  const userpath = result.stdout.trim().split("\n").pop()?.trim();
  return userpath ? join(userpath, "mip") : undefined;
}

export function bootstrapMip(): number {
  const matlab = resolveMatlabExecutable();

  process.stdout.write(
    `Installing mip via MATLAB ('${matlab}') — this runs\n` +
      `  eval(webread('${INSTALL_URL}'))\n`
  );
  const expr = `eval(webread(${matlabQuote(INSTALL_URL)}));`;
  const result = spawnSync(matlab, ["-batch", expr], { stdio: "inherit" });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      process.stderr.write(
        `Error: installing mip requires MATLAB, but '${matlab}' was not found.\n` +
          `Set MIP_MATLAB to your MATLAB executable, or re-run the install wizard.\n`
      );
      return 1;
    }
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }
  if (result.status !== 0) {
    // Covers both installer failure and the user aborting the installer.
    process.stderr.write(
      "Error: the mip installer did not complete; mip was not installed.\n"
    );
    return 1;
  }

  // Record where the installation landed, unless the user already directs
  // the CLI elsewhere via MIP_HOME or an existing config entry.
  if (!configuredMipHome()) {
    const home = defaultMipHome(matlab);
    if (home && existsSync(join(home, "packages"))) {
      writeConfig({ ...readConfig(), mip_home: home });
      process.stdout.write(
        `Saved mip_home = ${home} to ${configFilePath()}\n`
      );
    } else {
      process.stderr.write(
        "Note: could not determine where mip was installed. Set MIP_HOME " +
          "(or re-run the install wizard) so the CLI can find it.\n"
      );
    }
  }
  return 0;
}
