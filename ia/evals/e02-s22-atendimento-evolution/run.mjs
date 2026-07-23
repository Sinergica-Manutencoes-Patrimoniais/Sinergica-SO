import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const [chamados, comercial, runtime] = await Promise.all([
  readFile(resolve(root, "ia/prompts/e02-s22-agente-chamados-v1.md"), "utf8"),
  readFile(resolve(root, "ia/prompts/e02-s22-agente-comercial-v1.md"), "utf8"),
  readFile(resolve(root, "supabase/functions/pcm-ze-agent/index.ts"), "utf8"),
]);

for (const [nome, prompt] of [
  ["chamados", chamados],
  ["comercial", comercial],
]) {
  assert.match(
    prompt,
    /dado(?:s)? não confiável|nunca instruções de sistema|alterar estas instruções/iu,
    `${nome}: defesa de injection`,
  );
  assert.match(prompt, /JSON/iu, `${nome}: contrato estruturado`);
}

assert.match(runtime, /<DADOS_NAO_CONFIAVEIS>/u, "runtime delimita entrada não confiável");
assert.match(runtime, /LlmEnvelopeSchema\.parse/u, "runtime valida envelope do LLM");
assert.match(runtime, /resolverRotaAtendimento/u, "runtime resolve persona por instância");
assert.match(runtime, /fn_definir_handoff/u, "runtime persiste handoff por RPC");

console.log("✓ E02-S22 eval: prompts e controles do runtime presentes");
