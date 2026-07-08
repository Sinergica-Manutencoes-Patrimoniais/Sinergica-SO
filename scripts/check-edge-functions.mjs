#!/usr/bin/env node
// Gate de consistência de Edge Functions (E00-S11) — nasce do incidente em que uma função existia
// no repo mas não estava deployada (config.toml não a declarava) e a UI só descobria via 404.
// Uso: node scripts/check-edge-functions.mjs
// Sai com código 1 se houver função órfã (sem bloco em config.toml) ou um `functions.invoke`
// apontando para uma função inexistente/não declarada.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative, extname } from "node:path";

const ROOT = resolve(process.argv[2] || ".");
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");
const CONFIG_TOML = join(ROOT, "supabase", "config.toml");
const WEB_SRC = join(ROOT, "apps", "web", "src");

// Pastas que não são funções deployáveis (allowlist explícita — AC-1).
const NOT_A_FUNCTION = new Set(["_shared", "_template", "_examples"]);

const errors = [];
const warnings = [];

function listFunctionFolders() {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => !NOT_A_FUNCTION.has(name) && !name.startsWith("."))
    .filter((name) => statSync(join(FUNCTIONS_DIR, name)).isDirectory());
}

function parseDeclaredFunctions(tomlText) {
  // Parser mínimo: só precisa reconhecer `[functions.<nome>]`. Não interpreta o TOML inteiro.
  const declared = new Set();
  const re = /^\[functions\.([a-zA-Z0-9_-]+)\]/gm;
  let m;
  while ((m = re.exec(tomlText)) !== null) declared.add(m[1]);
  return declared;
}

function walkTsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (extname(full) === ".ts" || extname(full) === ".tsx") {
      out.push(full);
    }
  }
  return out;
}

function findInvokeCalls(files) {
  // Casa `functions.invoke("literal")` / `.invoke('literal')`. Nome dinâmico (variável, template
  // literal com interpolação) não é verificável estaticamente — vira aviso, nunca falso positivo.
  const calls = [];
  const literalRe = /functions\.invoke\(\s*["'`]([a-zA-Z0-9_-]+)["'`]/g;
  const dynamicRe = /functions\.invoke\(\s*(?!["'`])/g;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    let m;
    literalRe.lastIndex = 0;
    while ((m = literalRe.exec(text)) !== null) {
      calls.push({ file, name: m[1], dynamic: false });
    }
    dynamicRe.lastIndex = 0;
    while ((m = dynamicRe.exec(text)) !== null) {
      calls.push({ file, name: null, dynamic: true });
    }
  }
  return calls;
}

const folders = listFunctionFolders();
const tomlText = existsSync(CONFIG_TOML) ? readFileSync(CONFIG_TOML, "utf8") : "";
const declared = parseDeclaredFunctions(tomlText);

// AC-1: pasta sem declaração em config.toml.
for (const name of folders) {
  if (!declared.has(name)) {
    errors.push(
      `Função órfã: supabase/functions/${name}/ existe mas não está declarada em ` +
        `supabase/config.toml ([functions.${name}]) — não será deployada pela GitHub Integration.`,
    );
  }
}

// AC-2: functions.invoke apontando para função inexistente ou não declarada.
const tsFiles = walkTsFiles(WEB_SRC);
const invokeCalls = findInvokeCalls(tsFiles);
const folderSet = new Set(folders);
for (const call of invokeCalls) {
  if (call.dynamic) {
    warnings.push(`${relative(ROOT, call.file)}: functions.invoke com nome dinâmico — não verificável estaticamente.`);
    continue;
  }
  if (!folderSet.has(call.name)) {
    errors.push(
      `${relative(ROOT, call.file)}: functions.invoke("${call.name}") não corresponde a nenhuma ` +
        `pasta em supabase/functions/.`,
    );
    continue;
  }
  if (!declared.has(call.name)) {
    errors.push(
      `${relative(ROOT, call.file)}: functions.invoke("${call.name}") aponta para uma função que ` +
        `existe no repo mas não está declarada em supabase/config.toml.`,
    );
  }
}

if (warnings.length > 0) {
  console.warn(`⚠ ${warnings.length} aviso(s):`);
  for (const w of warnings) console.warn(`  - ${w}`);
}

if (errors.length > 0) {
  console.error(`✗ check-edge-functions: ${errors.length} problema(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ check-edge-functions: ${folders.length} função(ões) declarada(s), ${invokeCalls.length - warnings.length} invoke(s) verificado(s).`);
