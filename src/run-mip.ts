/**
 * Run a mip command by interpreting the MATLAB-installed mip source with
 * numbl. The directory containing mip.m / +mip is added to numbl's search
 * path, so the exact same code runs here as runs inside MATLAB.
 */

import { readSync } from "fs";
import { executeCode, RuntimeError } from "numbl";
import type { WorkspaceFile } from "numbl";
import { NodeFileIOAdapter, NodeSystemAdapter, scanMFiles } from "numbl/node";
import { resolveEffectiveRoot, resolveMipSourceDir } from "./mip-root.js";

/** Quote a string as a MATLAB single-quoted char literal. */
function matlabQuote(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

/** Synchronous line reader for the input() builtin (confirmation prompts). */
function readLineSync(prompt: string): string {
  process.stdout.write(prompt);
  const buf = Buffer.alloc(1);
  let line = "";
  while (true) {
    let bytesRead: number;
    try {
      bytesRead = readSync(0, buf, 0, 1, null);
    } catch {
      break; // stdin closed or unreadable — treat as EOF
    }
    if (bytesRead === 0) break; // EOF
    const ch = buf.toString("utf8");
    if (ch === "\n") break;
    if (ch === "\r") continue;
    line += ch;
  }
  return line;
}

export function runMipCommand(command: string, args: string[]): number {
  const mipSourceDir = resolveMipSourceDir();

  // Pin the root for the interpreted mip: it reads MIP_ROOT via getenv,
  // and the CLI has already resolved which root this command targets
  // (MIP_ROOT if set, else the installation's own root).
  process.env.MIP_ROOT = resolveEffectiveRoot(mipSourceDir);

  const searchPaths: string[] = [mipSourceDir];
  const workspaceFiles: WorkspaceFile[] = scanMFiles(mipSourceDir);

  const code =
    "mip(" + [command, ...args].map(matlabQuote).join(", ") + ");";

  try {
    executeCode(
      code,
      {
        displayResults: false,
        onOutput: (text: string) => process.stdout.write(text),
        fileIO: new NodeFileIOAdapter(),
        system: new NodeSystemAdapter(),
        onInput: readLineSync,
      },
      workspaceFiles,
      "eval.m",
      searchPaths
    );
    return 0;
  } catch (err) {
    if (err instanceof RuntimeError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
}
