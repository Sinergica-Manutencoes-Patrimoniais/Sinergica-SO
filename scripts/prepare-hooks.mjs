#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const isCi = process.env.CI === "true" || process.env.NETLIFY === "true" || process.env.GITHUB_ACTIONS === "true";

if (isCi) {
  console.log("prepare: pulando instalação de hooks Git em CI/Netlify");
  process.exit(0);
}

const localBin = process.platform === "win32" ? join("node_modules", ".bin", "lefthook.cmd") : join("node_modules", ".bin", "lefthook");
const command = existsSync(localBin) ? localBin : "lefthook";
const result = spawnSync(command, ["install"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
