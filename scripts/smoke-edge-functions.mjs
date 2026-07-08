#!/usr/bin/env node
// Smoke-test pós-deploy das Edge Functions (E01-S35, AC-5) — nasce do mesmo incidente do gate
// check-edge-functions.mjs: uma função pode estar corretamente declarada em config.toml e mesmo
// assim não ter sido deployada de fato (integração nativa desligada/quebrada, secret ausente etc.).
// Este script pinga cada função DEPLOYADA e falha (exit 1) se qualquer uma responder 404 — a
// única forma confiável de saber que o deploy realmente aconteceu, sem depender de "achar que sim".
//
// Uso: SUPABASE_PROJECT_ID=<ref> node scripts/smoke-edge-functions.mjs
// 404 = função não existe no projeto (deploy não rodou) → falha.
// 5xx = blob existe, mas não inicializou/respondeu corretamente → falha.
// 200/204/400/401/403/405 = função existe e respondeu → passa. Este script não valida a lógica
// de negócio, somente disponibilidade básica e bootstrap do runtime.

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(process.argv[2] || ".");
const CONFIG_TOML = join(ROOT, "supabase", "config.toml");
const PROJECT_ID = process.env.SUPABASE_PROJECT_ID;
const TIMEOUT_MS = 10_000;
// A GitHub Integration nativa do Supabase deploya de forma assíncrona ao merge — o push que
// dispara este workflow pode chegar antes do deploy terminar. Retry com backoff evita falso
// positivo (função real, deploy só ainda não propagou).
const RETRIES = Number(process.env.SMOKE_RETRIES ?? 5);
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 20_000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!PROJECT_ID) {
  console.error("✗ smoke-edge-functions: env SUPABASE_PROJECT_ID ausente.");
  process.exit(1);
}

function parseDeclaredFunctions(tomlText) {
  const declared = [];
  const re = /^\[functions\.([a-zA-Z0-9_-]+)\]/gm;
  let m;
  while ((m = re.exec(tomlText)) !== null) declared.push(m[1]);
  return declared;
}

async function probeOnce(name) {
  const url = `https://${PROJECT_ID}.supabase.co/functions/v1/${name}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "OPTIONS", signal: controller.signal });
    return { name, status: res.status, ok: res.status !== 404 && res.status < 500 };
  } catch (e) {
    return { name, status: `erro de rede (${e.message})`, ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function probe(name) {
  let result = await probeOnce(name);
  for (let attempt = 1; !result.ok && attempt < RETRIES; attempt++) {
    await sleep(RETRY_DELAY_MS);
    result = await probeOnce(name);
  }
  return result;
}

const tomlText = readFileSync(CONFIG_TOML, "utf8");
const functions = parseDeclaredFunctions(tomlText);

if (functions.length === 0) {
  console.error("✗ smoke-edge-functions: nenhuma função declarada em supabase/config.toml.");
  process.exit(1);
}

const results = await Promise.all(functions.map(probe));
const failed = results.filter((r) => !r.ok);

for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.name} — ${r.status}`);
}

if (failed.length > 0) {
  console.error(`\n✗ smoke-edge-functions: ${failed.length}/${functions.length} função(ões) indisponível(is) (404/5xx).`);
  process.exit(1);
}

console.log(`\n✓ smoke-edge-functions: ${functions.length}/${functions.length} função(ões) deployada(s).`);
