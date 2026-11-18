#!/usr/bin/env node
// E01-S198 SC-004/AC-8/AC-9 — guarda de CI pra `supabase/functions/pcm-api-dominio/index.ts`, o
// ÚNICO caminho externo pro staging (FR-001/FR-005). Toda ação nova nesse arquivo precisa das
// cinco camadas (autenticação, autorização herdada, validação, idempotência, auditoria herdada)
// e NUNCA pode introduzir SQL genérico/nome dinâmico de RPC — sem isso a API vira exatamente a
// "integração paralela" que o pacote quer evitar.
import { readFileSync } from "node:fs";

const ARQUIVO = "supabase/functions/pcm-api-dominio/index.ts";

function falhar(motivo) {
  console.error(`✗ check-api-dominio-cinco-camadas: ${motivo}`);
  process.exit(1);
}

let conteudo;
try {
  conteudo = readFileSync(ARQUIVO, "utf8");
} catch {
  falhar(`${ARQUIVO} não encontrado — se a API de domínio foi removida/renomeada, atualize este guard também.`);
}

// AC-8: nenhuma chamada de RPC com nome vindo de variável/template — só string literal fixa.
// Pega `.rpc(` seguido de qualquer coisa que não comece com aspas (ex.: `.rpc(nomeDinamico,`).
const RPC_DINAMICO = /\.rpc\(\s*[^"'`]/;
if (RPC_DINAMICO.test(conteudo)) {
  falhar("chamada de RPC com nome não-literal encontrada — toda ação precisa de nome de RPC fixo (AC-8).");
}

// AC-8: proibido qualquer execução de SQL genérico (ferramenta tipo exec_sql/query arbitrária).
const SQL_GENERICO = /exec_sql|"sql"\s*:|raw_sql|\bquery\s*:\s*req/i;
if (SQL_GENERICO.test(conteudo)) {
  falhar("padrão de SQL genérico/consulta arbitrária encontrado — proibido por desenho (AC-8).");
}

// Camada 1 — autenticação.
if (!conteudo.includes("requireAuth(")) {
  falhar("requireAuth não encontrado — camada 1 (autenticação) é obrigatória em toda rota.");
}

// Camada 3 — validação: todo payload precisa passar por Zod antes de chegar numa RPC.
if (!/z\.object\(|Schema\.parse\(/.test(conteudo)) {
  falhar("nenhum schema Zod encontrado — camada 3 (validação) é obrigatória em toda ação.");
}

// Camada 4 — idempotência: toda ação de ESCRITA precisa exigir requestId (ações de leitura, não).
if (!conteudo.includes("requestId")) {
  falhar("nenhuma referência a requestId — camada 4 (idempotência) é obrigatória em toda ação de escrita.");
}

// Camada 2/5 — autorização e auditoria são HERDADAS da RPC de domínio (nunca reimplementadas
// aqui, Assumptions da spec) — o guard confirma que o client usado é o do USUÁRIO (anon key +
// Authorization repassado), nunca service_role, que é a única forma de a herança funcionar
// (sem isso, auth.uid()/sso_autorizar_acao dentro da RPC nunca veem o ator real).
if (conteudo.includes("getSupabaseServiceKey") || conteudo.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  falhar("uso de service_role detectado — a API de domínio só pode chamar RPCs no contexto do usuário (camada 2 herdada).");
}
if (!conteudo.includes("SUPABASE_ANON_KEY")) {
  falhar("client no contexto do usuário (anon key + Authorization) não encontrado.");
}

console.log("✓ check-api-dominio-cinco-camadas: cinco camadas presentes, sem SQL genérico, sem service_role.");
process.exit(0);
