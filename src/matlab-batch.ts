/**
 * Run a mip command in a real MATLAB session via `matlab -batch`.
 *
 * Used for the commands that genuinely need MATLAB (test: runs a package's
 * test script; compile: runs a compile_script that calls mex).
 *
 * The batch expression is self-contained: it sets MIP_ROOT inside the
 * session to the same root the CLI resolved outside, and addpath's the mip
 * source directory before calling mip. This deliberately does not rely on
 * mip being on MATLAB's saved path — the saved path belongs to whichever
 * MATLAB installation mip was installed from, and the MATLAB launched here
 * (MIP_MATLAB / the wizard-configured one) may be a different version.
 */

import { spawnSync } from "child_process";
import { matlabQuote, resolveMatlabExecutable } from "./matlab.js";
import { resolveEffectiveRoot, resolveMipSourceDir } from "./mip-root.js";

export function runMatlabBatch(command: string, args: string[]): number {
  const mipSourceDir = resolveMipSourceDir();
  const root = resolveEffectiveRoot(mipSourceDir);
  const matlab = resolveMatlabExecutable();

  const expr = [
    `setenv('MIP_ROOT', ${matlabQuote(root)});`,
    `addpath(${matlabQuote(mipSourceDir)});`,
    "mip(" + [command, ...args].map(matlabQuote).join(", ") + ");",
  ].join(" ");

  const result = spawnSync(matlab, ["-batch", expr], { stdio: "inherit" });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      process.stderr.write(
        `Error: 'mip ${command}' requires MATLAB, but '${matlab}' was not found.\n` +
          `Set MIP_MATLAB to your MATLAB executable, or re-run the install wizard.\n`
      );
      return 1;
    }
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}
