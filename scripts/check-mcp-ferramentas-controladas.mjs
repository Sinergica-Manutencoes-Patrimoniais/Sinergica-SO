#!/usr/bin/env node
// E02-S43 AC-2/AC-3/SC-001/SC-002 — guarda de CI pra `supabase/functions/pcm-mcp/index.ts`. O
// MCP NUNCA pode tocar o banco diretamente (`.rpc(`/`.from(` em schema de domínio) — a única
// forma de efeito é `fetch` pra `pcm-api-dominio`. Sem essa trava estrutural, basta uma ação
// futura "mais rápida" chamando a RPC direto pra reabrir exatamente o risco que a E01-S198 já
// fechou (API virando túnel pro banco).
import { readFileSync } from "node:fs";

const ARQUIVO = "supabase/functions/pcm-mcp/index.ts";

function falhar(motivo) {
  console.error(`✗ check-mcp-ferramentas-controladas: ${motivo}`);
  process.exit(1);
}

let conteudo;
try {
  conteudo = readFileSync(ARQUIVO, "utf8");
} catch {
  falhar(`${ARQUIVO} não encontrado — se o MCP foi removido/renomeado, atualize este guard também.`);
}

// AC-2: nenhuma chamada a RPC/tabela de domínio além da que registra o próprio uso (camada de
// auditoria do MCP, não dado de domínio) — tudo o mais tem que ir por `fetch` pra pcm-api-dominio.
const CHAMADAS_SCHEMA_PCM = [...conteudo.matchAll(/\.schema\("pcm"\)\s*\.rpc\(\s*"([^"]+)"/g)].map((m) => m[1]);
const PERMITIDAS = new Set(["sso_registrar_uso_mcp"]);
const foraDaLista = CHAMADAS_SCHEMA_PCM.filter((nome) => !PERMITIDAS.has(nome));
if (foraDaLista.length > 0) {
  falhar(`chamada direta a RPC de domínio fora da auditoria própria: ${foraDaLista.join(", ")} — dado tem que vir de pcm-api-dominio via fetch (AC-2).`);
}
if (/\.schema\("pcm"\)\s*\.from\(/.test(conteudo)) {
  falhar('acesso direto a tabela via `.from(` encontrado — proibido (AC-2, "nunca acessa o banco diretamente").');
}

// AC-3: nenhum padrão de SQL genérico/consulta arbitrária.
if (/exec_sql|"sql"\s*:|raw_sql/i.test(conteudo)) {
  falhar("padrão de SQL genérico encontrado — proibido por desenho (AC-3).");
}

// A única superfície de efeito é o fetch pra pcm-api-dominio.
if (!conteudo.includes("/functions/v1/pcm-api-dominio")) {
  falhar("nenhuma chamada a pcm-api-dominio encontrada — ferramenta de dado tem que passar por lá (AC-2).");
}

// Nunca service_role.
if (conteudo.includes("getSupabaseServiceKey") || conteudo.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  falhar("uso de service_role detectado — toda chamada tem que rodar no contexto do usuário real.");
}

// AC-6/AC-8: toda chamada de ferramenta precisa registrar uso (sucesso ou recusa).
if (!conteudo.includes("sso_registrar_uso_mcp")) {
  falhar("registro de uso (sso_registrar_uso_mcp) não encontrado — AC-6/AC-8 exigem log de toda chamada.");
}

console.log("✓ check-mcp-ferramentas-controladas: sem acesso direto ao banco, sem SQL genérico, registro de uso presente.");
process.exit(0);
