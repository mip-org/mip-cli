/**
 * The mip-cli configuration file, written by the install wizard
 * (install.sh) and read at startup. It records the two facts the CLI
 * cannot cheaply discover on its own:
 *
 *   - mip_home: where the mip installation lives (used to locate mip.m)
 *   - matlab:   which MATLAB executable to launch for `test`/`compile`
 *
 * Environment variables always take precedence over the config file:
 * MIP_HOME overrides mip_home, MIP_MATLAB overrides matlab.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

export interface MipCliConfig {
  /** Directory of the mip installation used to locate mip.m. */
  mip_home?: string;
  /** MATLAB executable to launch for commands that need MATLAB. */
  matlab?: string;
}

/**
 * Path of the config file: $XDG_CONFIG_HOME/mip-cli/config.json
 * (~/.config/mip-cli/config.json), or %APPDATA%\mip-cli\config.json on
 * Windows.
 */
export function configFilePath(): string {
  if (process.platform === "win32" && process.env.APPDATA) {
    return join(process.env.APPDATA, "mip-cli", "config.json");
  }
  const configHome =
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configHome, "mip-cli", "config.json");
}

export function readConfig(): MipCliConfig {
  const file = configFilePath();
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf-8"));
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function writeConfig(config: MipCliConfig): void {
  const file = configFilePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
}
