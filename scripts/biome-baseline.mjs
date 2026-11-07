#!/usr/bin/env node
// Dívida temporária: não autoriza novos diagnósticos nem alterações silenciosas em arquivos devedores.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const baselinePath = resolve(root, "scripts/biome-baseline.json");
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function collect(report, readSource) {
  if (!Array.isArray(report.diagnostics) || !report.summary || report.summary.diagnosticsNotPrinted !== 0) {
    throw new Error("Relatório Biome incompleto ou inválido");
  }
  const files = {};
  for (const diagnostic of report.diagnostics) {
    const path = diagnostic.location?.path?.file;
    if (typeof path !== "string" || !diagnostic.category || !diagnostic.description) {
      throw new Error("Diagnóstico Biome sem arquivo ou identificação");
    }
    const absolute = resolve(root, path);
    const name = relative(root, absolute).split(sep).join("/");
    if (!name || name === ".." || name.startsWith("../") || isAbsolute(name)) {
      throw new Error(`Arquivo fora do repositório: ${path}`);
    }
    const entry = files[name] ??= { sha256: hash(readSource(absolute)), diagnostics: [] };
    entry.diagnostics.push(hash(JSON.stringify([
      diagnostic.category, diagnostic.severity, diagnostic.description, diagnostic.location.span,
    ])));
  }
  for (const entry of Object.values(files)) entry.diagnostics.sort();
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, "en")));
}

export function compare(current, baseline) {
  return Object.entries(current).filter(([name, value]) => {
    const old = baseline[name];
    return !old || old.sha256 !== value.sha256 || JSON.stringify(old.diagnostics) !== JSON.stringify(value.diagnostics);
  }).map(([name]) => name);
}

function main() {
  const result = spawnSync("pnpm", ["exec", "biome", "check", ".", "--reporter=json", "--max-diagnostics=100000"], {
    cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error || ![0, 1].includes(result.status)) throw result.error ?? new Error(`Biome terminou com status ${result.status}`);
  const report = JSON.parse(result.stdout);
  if ((result.status === 0) !== (report.summary?.errors === 0)) throw new Error("Resultado Biome inconsistente");
  const files = collect(report, readFileSync);
  if (process.argv[2] === "--write-baseline") {
    writeFileSync(baselinePath, `${JSON.stringify({ version: 1, files }, null, 2)}\n`);
    console.log(`Baseline registrada: ${report.diagnostics.length} diagnósticos em ${Object.keys(files).length} arquivos.`);
    return;
  }
  if (process.argv.length !== 2) throw new Error("Argumento desconhecido");
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (baseline.version !== 1 || !baseline.files || Array.isArray(baseline.files)) throw new Error("Baseline inválida");
  const changed = compare(files, baseline.files);
  if (changed.length) {
    console.error(`Biome: ${changed.length} arquivos têm apontamentos novos ou foram alterados enquanto ainda possuem dívida:\n${changed.join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Biome: nenhuma dívida nova. Restam ${report.diagnostics.length} apontamentos registrados em ${Object.keys(files).length} arquivos.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
