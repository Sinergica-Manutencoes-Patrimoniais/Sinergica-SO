#!/usr/bin/env node
// DEF-24 — gate: `ACOES_SSO` e `ACOES_INDIVIDUAIS` do front têm de espelhar `config.sso_acoes`.
//
// `concessaoSchema.acao` é `z.enum(ACOES_SSO)` e a listagem de concessões faz
// `z.array(schema).parse`: uma ação que existe no banco e falta na lista do front derruba a
// consulta inteira de concessões, de forma determinística — foi o que aconteceu quando a
// migration 1863 criou `execucao.contingencia_auvo` sem atualizar o front. `ACOES_INDIVIDUAIS`
// espelha `exige_concessao_individual`: divergir ali faz a prévia da interface prometer o que
// `config.sso_autorizar_acao` recusa.
//
// Roda no job `db-tests`, com o Supabase local de pé (mesmo padrão de check-jornadas-flags.mjs):
// o banco é a fonte de verdade, o front é o espelho. A porta padrão é a de `supabase/config.toml`
// ([db] port = 55322), não a 54322 do Supabase CLI — este projeto mudou a porta.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(fileURLToPath(new URL("..", import.meta.url)));
const arquivo = resolve(raiz, "apps/web/src/features/pcm/domain/capacidades-sso.ts");
const URL_BANCO =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

function listaDoFront(fonte, nome) {
  const bloco = new RegExp(`${nome}[^=]*=\\s*\\[([\\s\\S]*?)\\]`).exec(fonte);
  if (!bloco) throw new Error(`Não encontrei ${nome} em capacidades-sso.ts`);
  return [...bloco[1].matchAll(/"([a-z0-9_.]+)"/g)].map((m) => m[1]).sort();
}

function consultar(sql) {
  return execFileSync("psql", [URL_BANCO, "-At", "-c", sql], { encoding: "utf8" })
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .sort();
}

function comparar(rotulo, noBanco, noFront) {
  const faltando = noBanco.filter((x) => !noFront.includes(x));
  const sobrando = noFront.filter((x) => !noBanco.includes(x));
  if (!faltando.length && !sobrando.length) return [];
  const problemas = [];
  if (faltando.length) problemas.push(`${rotulo}: no banco e fora do front — ${faltando.join(", ")}`);
  if (sobrando.length) problemas.push(`${rotulo}: no front e fora do banco — ${sobrando.join(", ")}`);
  return problemas;
}

const fonte = readFileSync(arquivo, "utf8");
const problemas = [
  ...comparar("ACOES_SSO", consultar("select codigo from config.sso_acoes"), listaDoFront(fonte, "ACOES_SSO")),
  ...comparar(
    "ACOES_INDIVIDUAIS",
    consultar("select codigo from config.sso_acoes where exige_concessao_individual"),
    listaDoFront(fonte, "ACOES_INDIVIDUAIS"),
  ),
];

if (problemas.length) {
  console.error(`✗ check-acoes-sso: front fora de sincronia com config.sso_acoes.\n  ${problemas.join("\n  ")}`);
  process.exitCode = 1;
} else {
  console.log("✓ check-acoes-sso: ACOES_SSO e ACOES_INDIVIDUAIS espelham config.sso_acoes.");
}
