#!/usr/bin/env node
// Diagnóstico de prontidão de um ambiente para homologação. SÓ LEITURA — não aplica migration,
// não abre gate, não concede nada.
//
// Responde, em um comando, as três perguntas que precedem qualquer sessão de homologação:
//   1. Até qual migration o banco chegou? Ficou preso em alguma?
//   2. Quais gates das jornadas desta rodada estão abertos ou fechados?
//   3. Quais Edge Functions da rodada estão declaradas para deploy?
//
// Uso:  SUPABASE_DB_URL='postgresql://...' node scripts/diagnosticar-ambiente.mjs
// Sem SUPABASE_DB_URL, usa o Supabase local (`supabase start`).
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

// Migrations que esta rodada (17-19/11/2026) introduziu, com a jornada que cada uma sustenta.
const MIGRATIONS_DA_RODADA = [
  ["1854", "E01-S188", "Registro de ativação de jornadas"],
  ["1855", "E01-S188", "Abertura/retorno auditado de jornada"],
  ["1856", "E01-S188", "Listagem de jornadas"],
  ["1857", "E00-S26", "Capacidades sensíveis exigem concessão individual"],
  ["1858", "E01-S192", "Plano de origem da OS preventiva"],
  ["1859", "E00-S27", "Revogação imediata de acesso"],
  ["1860", "E01-S193", "Backlog antecede Chamado (estado 'demanda')"],
  ["1861", "E01-S194", "Validação PCM como etapa do Kanban"],
  ["1862", "E01-S195", "Trechos de deslocamento com enquadramento"],
  ["1863", "E01-S196", "Contingência Auvo auditada"],
  ["1864", "E01-S189", "Gates dos sete escritores sem grant"],
  ["1865", "E02-S43", "Registro de uso do MCP"],
  ["1866", "E01-S199", "Fila 'Campo a conciliar'"],
];

// Gates que a homologação desta rodada precisa, por jornada.
const GATES = [
  ["pcm", "sso_consulta_estado_campo_gate", "E01-S199 + E01-S175", "fila 'Campo a conciliar' e tela Estado de campo"],
  ["pcm", "sso_trechos_deslocamento_gate", "E01-S195", "trechos de deslocamento"],
  ["pcm", "chamado_os_gate", "E01-S167 + E01-S193", "várias OS por Chamado (efeito global)"],
  ["pcm", "sso_criacao_os_mediada_gate", "E01-S167", "criação mediada de OS a partir do Chamado"],
  ["pcm", "sso_backlog_composicao_gate", "E01-S193", "compor Backlog a partir de pendências"],
  ["pcm", "sso_promocao_backlog_gate", "E01-S193", "promover Backlog a Chamado"],
  ["pcm", "sso_backlog_chamado_gate", "E01-S193", "vínculo Backlog→Chamado"],
  ["pcm", "sso_backlog_parcela_gate", "E01-S193", "parcelas do Backlog"],
  ["pcm", "sso_divisao_backlog_gate", "E01-S193", "liberação parcial de escopo"],
  ["pcm", "sso_eventos_materiais_mediados_gate", "E01-S179", "eventos da Central de Materiais"],
];

const FUNCOES_DA_RODADA = ["pcm-api-dominio", "pcm-mcp", "pcm-auvo-t24-despachar", "pcm-auvo-open-task"];

function consultar(sql) {
  // `--no-align` sobrepõe o separador do `--csv` (vira `|`); os dois juntos não combinam.
  return execFileSync("psql", [DB_URL, "--csv", "--tuples-only", "-c", sql], {
    encoding: "utf8",
  }).trim();
}

function migrationsAplicadas() {
  const saida = consultar("select version from supabase_migrations.schema_migrations order by version;");
  return new Set(saida.length > 0 ? saida.split("\n") : []);
}

function estadoDosGates() {
  // Lê em uma consulta só; gate que não existe é sinal de migration não aplicada, não de gate fechado.
  const uniao = GATES.map(
    ([schema, tabela]) =>
      `select '${schema}.${tabela}' as gate, (select habilitado from ${schema}.${tabela} where id) as habilitado where to_regclass('${schema}.${tabela}') is not null`,
  ).join(" union all ");
  const saida = consultar(uniao);
  const mapa = new Map();
  for (const linha of saida.length > 0 ? saida.split("\n") : []) {
    const [gate, habilitado] = linha.split(",");
    mapa.set(gate, habilitado === "t");
  }
  return mapa;
}

function funcoesDeclaradas() {
  const toml = readFileSync("supabase/config.toml", "utf8");
  return new Set(
    [...toml.matchAll(/^\[functions\.([a-z0-9-]+)\]/gm)].map((m) => m[1]),
  );
}

function migrationsNoRepo() {
  return readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, 4))
    .sort();
}

function main() {
  let aplicadas;
  try {
    aplicadas = migrationsAplicadas();
  } catch (erro) {
    process.stderr.write(
      `diagnosticar-ambiente: não consegui conectar ao banco.\n` +
        `  Defina SUPABASE_DB_URL com a string de conexão do ambiente, ou suba o Supabase local.\n` +
        `  Detalhe: ${erro instanceof Error ? erro.message.split("\n")[0] : String(erro)}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const noRepo = migrationsNoRepo();
  const ultimaNoRepo = noRepo.at(-1);
  const faltando = noRepo.filter((v) => !aplicadas.has(v));

  console.log("\n=== 1. Migrations ===\n");
  console.log(`  No repositório: ${noRepo.length} (última: ${ultimaNoRepo})`);
  console.log(`  Aplicadas no banco: ${aplicadas.size}`);
  if (faltando.length === 0) {
    console.log("  ✓ Banco em dia — nenhuma migration pendente.");
  } else {
    console.log(`  ✗ ${faltando.length} migration(s) NÃO aplicada(s). Primeira: ${faltando[0]}`);
    console.log("    O deploy para na primeira que falha; tudo depois dela também fica de fora.");
  }

  console.log("\n  Rodada 17-19/11/2026:\n");
  for (const [versao, story, descricao] of MIGRATIONS_DA_RODADA) {
    console.log(`    ${aplicadas.has(versao) ? "✓" : "✗"} ${versao} ${story.padEnd(9)} ${descricao}`);
  }

  console.log("\n=== 2. Gates (trava de banco) ===\n");
  const gates = estadoDosGates();
  for (const [schema, tabela, story, descricao] of GATES) {
    const chave = `${schema}.${tabela}`;
    const estado = gates.has(chave) ? (gates.get(chave) ? "ABERTO " : "fechado") : "INEXISTENTE";
    console.log(`    ${estado}  ${chave.padEnd(42)} ${story.padEnd(19)} ${descricao}`);
  }
  console.log("\n    INEXISTENTE = a migration que cria o gate não foi aplicada (ver seção 1).");

  console.log("\n=== 3. Edge Functions declaradas para deploy ===\n");
  const declaradas = funcoesDeclaradas();
  for (const nome of FUNCOES_DA_RODADA) {
    console.log(`    ${declaradas.has(nome) ? "✓" : "✗"} ${nome}`);
  }
  console.log(
    "\n    A integração do Supabase só deploya função declarada em supabase/config.toml;\n" +
      "    função ausente dali é ignorada em silêncio, sem erro visível.\n",
  );

  console.log("=== Resumo ===\n");
  const pronto = faltando.length === 0;
  console.log(
    pronto
      ? "  Banco pronto para a sessão de ativação. Nenhuma migration pendente.\n"
      : `  Banco NÃO está pronto: ${faltando.length} migration(s) pendente(s), a partir da ${faltando[0]}.\n` +
          "  Aplique o deploy antes de abrir qualquer gate — abrir gate de migration ausente não é possível.\n",
  );
  console.log("  Flags de publicação (VITE_SSO_*) NÃO são visíveis daqui: elas vivem no build do");
  console.log("  site (Netlify), não no banco. Confira no painel do Netlify do ambiente.\n");
}

main();
