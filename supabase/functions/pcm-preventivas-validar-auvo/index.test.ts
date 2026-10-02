import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { contratoPreventivoCompleto, taskId } from "./index.ts";

Deno.test("contratoPreventivoCompleto — exige evidência válida para Sistema e Equipamento", () => {
  assertEquals(contratoPreventivoCompleto({}), false);
  assertEquals(
    contratoPreventivoCompleto({
      sistema: { tecnico: true, data: true, alvo: true, questionario: true },
    }),
    false,
  );
  assertEquals(
    contratoPreventivoCompleto({
      sistema: { tecnico: true, data: true, alvo: true, questionario: true },
      equipamento: { tecnico: true, data: true, alvo: true, questionario: true },
    }),
    true,
  );
});

Deno.test("taskId — aceita resposta Auvo com result numérico ou objeto", () => {
  assertEquals(taskId({ result: 123 }), 123);
  assertEquals(taskId({ result: { id: 124 } }), 124);
  assertEquals(taskId({ result: { taskID: 125 } }), 125);
  assertEquals(taskId({ result: { taskId: 126 } }), 126);
  assertEquals(taskId({}), null);
});
