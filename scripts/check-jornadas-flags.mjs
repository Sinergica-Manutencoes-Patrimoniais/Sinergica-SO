#!/usr/bin/env node
// Verifica a camada 'flag' do registro de jornadas (E01-S188, AC-2): toda flag VITE_SSO_* citada
// em config.sso_jornada_requisitos precisa existir de verdade em apps/web/src — senão o registro
// aponta para o vazio, que é pior do que não ter registro.
//
// As camadas 'gate' e 'grant' são verificadas por pgTAP (supabase/tests/E01-S188_integridade_registro.test.sql),
// porque to_regclass/to_regprocedure resolvem contra o schema real. 'flag' não tem equivalente
// dentro do Postgres — o código fonte do front não é visível de dentro do banco — por isso este
// script, que roda DEPOIS de `supabase start` no job db-tests (onde o banco já existe) e lê o
// registro via psql.
//
// Uso: node scripts/check-jornadas-flags.mjs   (requer supabase local rodando)

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DB_HOST = process.env.PGHOST || "127.0.0.1";
const DB_PORT = process.env.PGPORT || "55322";
const DB_USER = process.env.PGUSER || "postgres";
const DB_PASSWORD = process.env.PGPASSWORD || "postgres";
const FRONT_SRC = "apps/web/src";

function listarFlagsRegistradas() {
  const sql = "select identificador from config.sso_jornada_requisitos where camada = 'flag' order by 1;";
  const saida = execSync(
    `psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -At -d postgres -c "${sql}"`,
    { encoding: "utf8", env: { ...process.env, PGPASSWORD: DB_PASSWORD } },
  );
  return saida.split("\n").map((l) => l.trim()).filter(Boolean);
}

function varrerArquivosFonte(dir) {
  const arquivos = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) arquivos.push(...varrerArquivosFonte(caminho));
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.(ts|tsx)$/.test(nome)) arquivos.push(caminho);
  }
  return arquivos;
}

function main() {
  const flags = listarFlagsRegistradas();
  if (flags.length === 0) {
    console.log("✓ Nenhuma flag registrada em config.sso_jornada_requisitos ainda — nada a verificar.");
    return;
  }
  const arquivos = varrerArquivosFonte(FRONT_SRC);
  const fonteCompleta = arquivos.map((a) => readFileSync(a, "utf8")).join("\n");

  const orfas = flags.filter((flag) => !fonteCompleta.includes(flag));
  if (orfas.length > 0) {
    console.error(`✗ ${orfas.length} flag(s) registrada(s) em sso_jornada_requisitos sem uso em ${FRONT_SRC}:`);
    for (const f of orfas) console.error(`  - ${f}`);
    console.error("\nUm registro de jornada que aponta para flag inexistente é pior que nenhum registro (E01-S188, AC-2).");
    process.exit(1);
  }
  console.log(`✓ Todas as ${flags.length} flag(s) registradas existem em ${FRONT_SRC}.`);
}

main();
