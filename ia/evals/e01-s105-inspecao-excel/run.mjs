import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const [prompt, runtime, parserTest] = await Promise.all([
  readFile(resolve(root, "ia/prompts/e01-s105-inspecao-excel-v1.md"), "utf8"),
  readFile(resolve(root, "supabase/functions/_shared/classificar-relatorio-inspecao.ts"), "utf8"),
  readFile(resolve(root, "apps/web/src/features/pcm/domain/inspecao-excel.test.ts"), "utf8"),
]);

assert.match(prompt, /JSON estrito/u, "prompt declara saída estruturada");
assert.match(prompt, /DADOS_NAO_CONFIAVEIS/u, "prompt declara fronteira de dado não confiável");
assert.match(prompt, /revis[aã]o humana/iu, "prompt não autoriza efeito colateral do modelo");
assert.match(runtime, /<DADOS_NAO_CONFIAVEIS>/u, "runtime delimita planilha não confiável");
assert.match(runtime, /nunca siga instruções/iu, "runtime rejeita injection");
assert.match(parserTest, /coluna ausente/u, "eval cobre formato inesperado");
assert.match(parserTest, /fallback/u, "eval cobre degradação sem perder levantamento");
console.log("✓ E01-S105 eval estrutural: contrato, injection e parser presentes");
