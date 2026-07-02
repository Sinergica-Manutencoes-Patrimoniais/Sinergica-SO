#!/usr/bin/env node
// Lint de migrations SQL — gate na CI (job `migrations`) e no ci:local.
// Verifica DUAS pegadinhas que só apareceriam em produção:
//   1) DROP destrutivo sem reverso documentado (rollback impossível de auditar).
//   2) CREATE POLICY sem GRANT correspondente — o clássico do Postgres/Supabase: RLS roda
//      DEPOIS do privilégio de tabela. Sem GRANT ao role (ex.: authenticated), o Postgres nega
//      no nível de privilégio e a policy NUNCA é avaliada — a tabela fica inacessível mesmo com
//      a policy "certa". Quebra em produção, não só no teste.
//
// O GRANT pode estar em QUALQUER migration (não precisa ser a mesma que cria a policy) — uma
// migration já aplicada é imutável (nunca editada, ver convenção do projeto); o gate valida o
// estado CUMULATIVO do diretório de migrations, que é como o Postgres realmente aplica.
//
// Uso: node scripts/lint-migrations.mjs   (varre supabase/migrations/ — perfil OS deste repo)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.argv[2] || ".");
const DIRS = ["db/migrations", "supabase/migrations"];
const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

// Remove comentários (-- linha e /* bloco */) para não casar exemplos comentados.
const stripComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

let count = 0;
const files = [];
for (const dir of DIRS) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) continue;
  for (const name of readdirSync(full)) {
    if (name.endsWith(".sql")) files.push(join(full, name));
  }
}

// Passo 1: estado cumulativo (todas as migrations combinadas) — é contra isso que os GRANTs são
// checados, não arquivo a arquivo, porque uma migration já aplicada nunca é editada; o GRANT que
// destrava uma policy antiga pode (e deve) vir numa migration nova.
const combinedSql = files.map((f) => stripComments(readFileSync(f, "utf8")).toLowerCase()).join("\n");

function lintFile(path) {
  const raw = readFileSync(path, "utf8");
  const sql = stripComments(raw).toLowerCase();
  count++;

  // 1) DROP sem reverso (procura "reverso" no arquivo BRUTO — costuma estar em comentário).
  if (/\bdrop\s+(table|column|schema|type|function)\b/.test(sql) && !/reverso/i.test(raw)) {
    err(path, "DROP destrutivo sem '-- Reverso:' documentado no topo da migration");
  }

  // 2) CREATE POLICY exige GRANT — checado no estado CUMULATIVO (ver Passo 1).
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

for (const f of files) lintFile(f);

if (errors.length) {
  console.error(`\n✗ Lint de migrations: ${errors.length} problema(s)\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error("");
  process.exit(1);
}
console.log(
  `✓ Lint de migrations: ${count} arquivo(s) OK (DROP com reverso, CREATE POLICY com GRANT).`,
);
