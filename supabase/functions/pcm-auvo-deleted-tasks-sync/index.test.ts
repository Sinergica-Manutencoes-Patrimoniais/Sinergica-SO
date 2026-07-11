// Testes do helper puro de extração de ids de tarefa excluída — cobre AC-2 (idempotência via
// dedupe) de specs/E01-S58-reconciliacao-tarefas-excluidas/spec.md. O contrato real confirmou
// `taskID` (maiúsculo) como campo canônico; `id`/`taskId` ficam como fallback defensivo.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractDeletedTaskIds } from "./index.ts";

Deno.test("extractDeletedTaskIds — prioriza taskID, aceita fallbacks e deduplica", () => {
  assertEquals(
    extractDeletedTaskIds([
      { taskID: 76627279 },
      { id: 2 },
      { taskId: 3 },
      { taskID: 76627279 }, // duplicada — reprocessar nunca duplica
      { taskID: 5, id: 999 }, // taskID vence
    ]),
    [76627279, 2, 3, 5],
  );
});

Deno.test("extractDeletedTaskIds — descarta itens sem id numérico finito", () => {
  assertEquals(
    extractDeletedTaskIds([{}, { taskID: Number.NaN }, { taskID: Number.POSITIVE_INFINITY }]),
    [],
  );
  assertEquals(extractDeletedTaskIds([]), []);
});
