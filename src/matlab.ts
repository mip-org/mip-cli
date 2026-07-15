/**
 * Selection of the MATLAB executable used for commands that genuinely
 * need MATLAB. The MIP_MATLAB environment variable takes precedence,
 * then the matlab value the install wizard saved in the config file,
 * then plain 'matlab' from the PATH.
 */

import { readConfig } from "./config.js";

export function resolveMatlabExecutable(): string {
  return process.env.MIP_MATLAB || readConfig().matlab || "matlab";
}

/** Quote a string as a MATLAB single-quoted char literal. */
export function matlabQuote(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}
