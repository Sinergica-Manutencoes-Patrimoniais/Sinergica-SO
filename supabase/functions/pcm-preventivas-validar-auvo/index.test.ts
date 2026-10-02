import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  contratoPreventivoCompleto,
  evidenciaTaskPreventiva,
  montarPayloadCriacaoTask,
  resumoRespostaCriacaoTask,
  taskId,
  taskTesteExistente,
} from "./index.ts";

Deno.test("contratoPreventivoCompleto — exige evidência válida para Sistema e Equipamento", () => {
  assertEquals(contratoPreventivoCompleto({}), false);
  assertEquals(
    contratoPreventivoCompleto({
      sistema: {
        tecnico: true,
        data: true,
        tipo: true,
        alvo: true,
        questionario: true,
      },
    }),
    false,
  );
  assertEquals(
    contratoPreventivoCompleto({
      sistema: {
        tecnico: true,
        data: true,
        tipo: true,
        alvo: true,
        questionario: true,
      },
      equipamento: {
        tecnico: true,
        data: true,
        tipo: true,
        alvo: true,
        questionario: true,
      },
    }),
    true,
  );
});

Deno.test("taskId — aceita resposta Auvo com result numérico ou objeto", () => {
  assertEquals(taskId({ result: 123 }), 123);
  assertEquals(taskId({ result: { id: 124 } }), 124);
  assertEquals(taskId({ result: { taskID: 125 } }), 125);
  assertEquals(taskId({ result: { taskId: 126 } }), 126);
  assertEquals(taskId({ result: [{ taskID: 127 }] }), 127);
  assertEquals(taskId({}), null);
});

Deno.test("taskTesteExistente — prioriza externalId e recupera tentativa legada compatível", () => {
  const alvo = {
    externalId: "PREV-CONTRATO-equipamento-1-2-3",
    customerId: 1,
    equipmentId: 2,
    taskTypeId: 3,
  };
  assertEquals(
    taskTesteExistente({
      result: [{ taskID: 90, externalId: alvo.externalId }],
    }, alvo),
    90,
  );
  assertEquals(
    taskTesteExistente({
      result: {
        entityList: [{
          taskID: 91,
          customerId: 1,
          equipmentId: 2,
          taskTypeId: 3,
          orientation: "TESTE DE CONTRATO PCM PREVENTIVAS — não executar",
        }],
      },
    }, alvo),
    91,
  );
  assertEquals(
    taskTesteExistente({
      result: [{
        taskID: 92,
        orientation: "TESTE DE CONTRATO PCM PREVENTIVAS — não executar",
      }],
    }, alvo),
    92,
  );
  assertEquals(taskTesteExistente({ result: [] }, alvo), null);
});

Deno.test("resumoRespostaCriacaoTask — expõe contrato sem payload da task", () => {
  assertEquals(
    resumoRespostaCriacaoTask({
      result: { taskID: 12 },
      message: "Task incluída",
    }),
    "campos:message,result; result:obj(taskID) message:Task incluída",
  );
  assertEquals(
    resumoRespostaCriacaoTask({ result: [{ taskID: 13 }] }),
    "campos:result; result:array(1):obj(taskID)",
  );
  assertEquals(
    resumoRespostaCriacaoTask({ result: null }),
    "campos:result; result:null",
  );
});

Deno.test("montarPayloadCriacaoTask — usa nomes do contrato Auvo para tipo e equipamentos", () => {
  assertEquals(
    montarPayloadCriacaoTask({
      externalId: "prev-1",
      customerId: 1,
      taskType: 3,
      equipmentId: 9,
    }),
    {
      externalId: "prev-1",
      customerId: 1,
      taskType: 3,
      equipmentsId: [9],
      orientation: "TESTE DE CONTRATO PCM PREVENTIVAS — não executar",
      priority: 1,
    },
  );
});

Deno.test("evidenciaTaskPreventiva — reconhece lista de equipamentos e questionnaireId da resposta Auvo", () => {
  assertEquals(
    evidenciaTaskPreventiva(
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
    { tecnico: true, data: true, tipo: true, alvo: true, questionario: true },
  );
});
