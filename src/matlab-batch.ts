/**
 * Run a mip command in a real MATLAB session via `matlab -batch`.
 *
 * Used for the commands that genuinely need MATLAB (test: runs a package's
 * test script; compile: runs a compile_script that calls mex). Requires mip
 * to be on the MATLAB path, which is the case for a standard installation.
 */

import { spawnSync } from "child_process";

function matlabQuote(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

export function runMatlabBatch(command: string, args: string[]): number {
  const expr = "mip(" + [command, ...args].map(matlabQuote).join(", ") + ")";
  const result = spawnSync("matlab", ["-batch", expr], { stdio: "inherit" });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      process.stderr.write(
        `Error: 'mip ${command}' requires MATLAB, but 'matlab' was not found on the PATH.\n`
      );
      return 1;
    }
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}
