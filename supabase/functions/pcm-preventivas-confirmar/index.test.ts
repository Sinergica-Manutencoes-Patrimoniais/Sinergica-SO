import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extrairTaskId, tarefaPreventivaConfirmada } from "./index.ts";

Deno.test("extrairTaskId — aceita envelope real do Auvo com result em array", () => {
  assertEquals(extrairTaskId({ result: [{ taskID: 80612378 }] }), 80612378);
});

Deno.test("tarefaPreventivaConfirmada — exige técnico, data, tipo, alvo e questionário", () => {
  assertEquals(
    tarefaPreventivaConfirmada(
      {
        idUserTo: 7,
        taskDate: "2026-10-03T16:00:00",
        taskType: 3,
        equipmentsId: [9],
        questionnaires: [{ questionnaireId: 4 }],
      },
      {
        tecnicoId: 7,
        visitaEm: "2026-10-03T16:00:00.000Z",
        taskType: 3,
        equipmentId: 9,
        questionarioId: 4,
      },
    ),
    true,
  );
});

Deno.test("tarefaPreventivaConfirmada — aceita questionário serializado no retorno do Auvo", () => {
  assertEquals(
    tarefaPreventivaConfirmada(
      {
        idUserTo: 7,
        taskDate: "2026-10-03T16:00:00",
        taskType: 3,
        equipmentsId: [9],
        questionnaires: JSON.stringify({
          entityList: [{ questionnaireID: 4 }],
        }),
      },
      {
        tecnicoId: 7,
        visitaEm: "2026-10-03T16:00:00.000Z",
        taskType: 3,
        equipmentId: 9,
        questionarioId: 4,
      },
    ),
    true,
  );
});
