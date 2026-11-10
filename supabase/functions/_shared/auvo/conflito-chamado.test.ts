import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { registrarConflitoChamado } from "./conflito-chamado.ts";

Deno.test("registra somente erro da guarda com identificadores mínimos", async () => {
  const calls: unknown[] = [];
  const registrar = async (args: unknown) => { calls.push(args); return { error: null, data: "18593000-0000-4000-8000-000000000021" }; };
  assertEquals(await registrarConflitoChamado({ code: "23514", message: "chamado_encerrado_requer_reabertura_formal" }, registrar, "os-1", 123, "em_execucao"), "registrado");
  assertEquals(calls, [{ p_os_id: "os-1", p_auvo_task_id: 123, p_status_remoto: "em_execucao" }]);
});

Deno.test("erro distinto não cria conflito", async () => {
  let called = false;
  const registrar = async () => { called = true; return { error: null, data: null }; };
  assertEquals(await registrarConflitoChamado({ code: "23514", message: "outra_constraint" }, registrar, "os-1", 123, "em_execucao"), "nao_aplicavel");
  assertEquals(called, false);
});

Deno.test("falha ou exceção da captura é sinalizada sem propagar conteúdo sensível", async () => {
  const error = { code: "23514", message: "chamado_encerrado_requer_reabertura_formal" };
  assertEquals(await registrarConflitoChamado(error, async () => ({ error: new Error("segredo"), data: null }), "os-1", 123, "em_execucao"), "falhou");
  assertEquals(await registrarConflitoChamado(error, async () => { throw new Error("segredo"); }, "os-1", 123, "em_execucao"), "falhou");
  assertEquals(await registrarConflitoChamado(error, async () => ({ error: null, data: null }), "os-1", 123, "em_execucao"), "falhou");
});
