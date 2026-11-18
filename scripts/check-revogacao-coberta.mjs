#!/usr/bin/env node
// E00-S27 FR-005/AC-8 — guarda de CI contra policy RLS nova que confia só em `auth.jwt()`
// sem releitura ao vivo (fica cega a revogação até o token expirar, ver ADR-1691).
//
// Não retrofita o histórico (fora de escopo — 0234/E01-S184 é o único precedente anterior a esta
// story e já é tolerado). A partir da migration desta story (1855) em diante, toda `create policy`
// nova que referencie `auth.jwt() ->> 'user_role'` precisa também referenciar uma das funções
// sancionadas de releitura ao vivo na MESMA definição — senão falha.
//
// Uso: node scripts/check-revogacao-coberta.mjs
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LIMIAR_MIGRATION = 1855; // inclusive — esta story e daqui pra frente
const FUNCOES_SANCIONADAS = [
  "config.sso_acesso_atual",
  "config.sso_autorizar_acao",
  "config.s184_acesso_interno_atual",
];

function numeroDaMigration(nomeArquivo) {
  const m = /^(\d+)_/.exec(nomeArquivo);
  return m ? Number(m[1]) : null;
}

function extrairPolicies(sql) {
  const regex = /create\s+policy\s+"?([\w.]+)"?\s+on\s+([\w.]+)[\s\S]*?(?=create\s+policy|$)/gi;
  const blocos = [];
  for (const m of sql.matchAll(regex)) {
    const fim = sql.indexOf(";", m.index);
    blocos.push(sql.slice(m.index, fim > -1 ? fim + 1 : m.index + m[0].length));
  }
  return blocos;
}

async function main() {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const arquivos = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  const achados = [];

  for (const arquivo of arquivos) {
    const numero = numeroDaMigration(arquivo);
    if (numero === null || numero < LIMIAR_MIGRATION) continue;
    const sql = await readFile(join(fileURLToPath(dir), arquivo), "utf8");
    for (const bloco of extrairPolicies(sql)) {
      if (!/auth\.jwt\(\)\s*->>\s*'user_role'/i.test(bloco)) continue;
      const temFuncaoSancionada = FUNCOES_SANCIONADAS.some((f) => bloco.includes(f));
      if (!temFuncaoSancionada) {
        const nome = /create\s+policy\s+"?([\w.]+)"?\s+on\s+([\w.]+)/i.exec(bloco);
        achados.push({
          arquivo,
          policy: nome?.[1] ?? "?",
          tabela: nome?.[2] ?? "?",
        });
      }
    }
  }

  if (achados.length > 0) {
    console.error(
      "✗ check-revogacao-coberta: policy nova confia em auth.jwt() sem releitura ao vivo (ADR-1691):",
    );
    for (const a of achados) console.error(`  ${a.arquivo}: policy "${a.policy}" em ${a.tabela}`);
    console.error(
      `  Adicione config.sso_acesso_atual(...)/sso_autorizar_acao(...)/s184_acesso_interno_atual(...) na mesma policy, ou troque a lógica pra não confiar só no JWT.`,
    );
    process.exit(1);
  }
  console.log(
    `✓ check-revogacao-coberta: nenhuma policy nova (migration >= ${LIMIAR_MIGRATION}) confia só em auth.jwt() sem releitura ao vivo.`,
  );
}

main();
