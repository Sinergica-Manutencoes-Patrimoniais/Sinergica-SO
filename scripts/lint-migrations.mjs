#!/usr/bin/env node
// Lint de migrations SQL — gate no pre-push (Lefthook) e na CI (job `migrations`).
//
// Divisão de responsabilidade:
//   • SEGURANÇA de migration (locks, breaking change, downtime) → SQUAWK (squawkhq.com).
//     Rodado aqui best-effort (se instalado); BLOQUEANTE na CI via squawk-action.
//   • Convenções da Trivia que Squawk não cobre (checadas SEMPRE aqui, bloqueantes):
//       1) DROP destrutivo sem '-- Reverso:' documentado (auditabilidade do rollback).
//       2) CREATE POLICY sem GRANT correspondente — o clássico do Postgres/Supabase: RLS roda
//          DEPOIS do privilégio de tabela. Sem GRANT ao role, a policy NUNCA é avaliada e a
//          tabela fica inacessível em produção, não só no teste. Nenhum linter pronto pega isto.
//
// O GRANT pode estar em QUALQUER migration (não precisa ser a mesma que cria a policy) — uma
// migration já aplicada é imutável (nunca editada, ver convenção do projeto); o gate valida o
// estado CUMULATIVO do diretório de migrations, que é como o Postgres realmente aplica.
//
// Uso: node scripts/lint-migrations.mjs   (varre supabase/migrations/ — perfil OS deste repo)

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.argv[2] || ".");
const DIRS = ["db/migrations", "supabase/migrations"];
const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

const stripComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

const files = [];
for (const dir of DIRS) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) continue;
  for (const name of readdirSync(full)) {
    if (name.endsWith(".sql")) files.push(join(full, name));
  }
}

// Estado cumulativo (todas as migrations combinadas) — é contra isso que os GRANTs são checados,
// não arquivo a arquivo (ver comentário acima).
const combinedSql = files.map((f) => stripComments(readFileSync(f, "utf8")).toLowerCase()).join("\n");

// ── Convenções Trivia (sempre, bloqueante) ───────────────────────────────────
function checkConventions(path) {
  const raw = readFileSync(path, "utf8");
  const sql = stripComments(raw).toLowerCase();

  if (/\bdrop\s+(table|column|schema|type|function)\b/.test(sql) && !/reverso/i.test(raw)) {
    err(path, "DROP destrutivo sem '-- Reverso:' documentado no topo da migration");
  }

  // Schema/tabela extraídos só do que segue "create policy ... on" (não qualquer "on x.y" do
  // arquivo — CREATE INDEX/FK também casam esse padrão e geravam falso positivo aqui).
  for (const m of sql.matchAll(
    /\bcreate\s+policy\s+"[^"]*"\s+on\s+([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/g,
  )) {
    const [, schema, table] = m;

    if (schema !== "public") {
      const usesUsage = new RegExp(
        `grant\\s+usage\\s+on\\s+schema\\s+([a-z_,\\s]*\\b${schema}\\b)`,
      ).test(combinedSql);
      if (!usesUsage) {
        err(
          path,
          `CREATE POLICY em '${schema}.${table}' sem GRANT USAGE ON SCHEMA ${schema} TO <role> ` +
            "(em qualquer migration) — o role não enxerga o schema, a policy nunca roda",
        );
      }
    }

    const hasTableGrant = new RegExp(
      `grant\\s+[a-z,\\s]+\\s+on\\s+[a-z_.,\\s]*\\b${schema}\\.${table}\\b`,
    ).test(combinedSql);
    if (!hasTableGrant) {
      err(
        path,
        `CREATE POLICY em '${schema}.${table}' sem GRANT correspondente (em qualquer migration) ` +
          "— RLS só é avaliada após o privilégio de tabela. Adicione GRANT SELECT/INSERT/UPDATE/" +
          "DELETE ... TO <role> (ver db/rls.template.sql)",
      );
    }
  }
}

// ── Squawk (segurança, best-effort local; bloqueante na CI via squawk-action) ───────────────
// devDependency (squawk-cli) instala o binário em node_modules/.bin, não no PATH do sistema —
// por isso a checagem/execução passam por `pnpm exec`, não pelo binário "nu".
const squawkInstalled = () => {
  try {
    execSync("pnpm exec squawk --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

function runSquawk() {
  if (files.length === 0) return;
  if (!squawkInstalled()) {
    console.log("… Squawk não instalado — segurança de migration só será checada na CI.");
    console.log("  (rode `pnpm install` — squawk-cli é devDependency — para o gate completo no pre-push)\n");
    return;
  }
  try {
    // --assume-in-transaction: o Supabase (CLI e GitHub Integration) roda cada arquivo de
    // migration dentro de uma transação — sem a flag, Squawk avisa "sem transação" em toda
    // migration (falso positivo para este ambiente).
    execSync(
      `pnpm exec squawk --assume-in-transaction ${files.map((f) => `"${f}"`).join(" ")}`,
      { stdio: "inherit" },
    );
    console.log("✓ Squawk: migrations seguras (sem lock/breaking-change bloqueante).\n");
  } catch {
    console.error("\n✗ Squawk reprovou uma migration (segurança). Veja acima.\n");
    process.exit(1);
  }
}

for (const f of files) checkConventions(f);

if (errors.length) {
  console.error(`\n✗ Convenções de migration: ${errors.length} problema(s)\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error("");
  process.exit(1);
}
console.log(
  `✓ Convenções OK em ${files.length} migration(s) (DROP com reverso, CREATE POLICY com GRANT).`,
);

runSquawk();
