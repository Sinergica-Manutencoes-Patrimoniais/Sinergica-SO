import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calcularInicioJanelaDeCursor,
  extractTaskId,
  mapTaskStatusToOsStatus,
  montarDetalhes,
} from "./index.ts";

Deno.test("extractTaskId — taskID é o campo real confirmado na API, id/taskId são fallback", () => {
  // Confirmado direto na API real (2026-07-09): GET /tasks devolve `taskID` (maiúsculo) — sem
  // isso, extractTaskId devolvia null pra toda tarefa e nenhuma OS nunca era criada.
  assertEquals(extractTaskId({ taskID: 789 }), 789);
  assertEquals(extractTaskId({ id: 123 }), 123);
  assertEquals(extractTaskId({ taskId: 456 }), 456);
  assertEquals(extractTaskId({}), null);
});

Deno.test("calcularInicioJanelaDeCursor — E01-S67: cursor presente usa (cursor - 3 dias de overlap)", () => {
  const agora = new Date("2026-07-13T12:00:00Z");
  const cursor = "2026-07-10T08:00:00.000Z"; // 3 dias atrás de "agora"
  const inicio = calcularInicioJanelaDeCursor(cursor, agora);
  assertEquals(inicio.toISOString(), "2026-07-07T08:00:00.000Z");
});

Deno.test("calcularInicioJanelaDeCursor — cursor recente (rodando de hora em hora) fica bem próximo de agora", () => {
  const agora = new Date("2026-07-13T12:00:00Z");
  const cursor = "2026-07-13T11:00:00.000Z"; // 1h atrás — cron horário
  const inicio = calcularInicioJanelaDeCursor(cursor, agora);
  assertEquals(inicio.toISOString(), "2026-07-10T11:00:00.000Z"); // cursor - 3 dias, não "agora - 3 dias"
});

Deno.test("calcularInicioJanelaDeCursor — sem cursor (bootstrap) cai no fallback fixo de 14 dias", () => {
  const agora = new Date("2026-07-13T12:00:00Z");
  const inicio = calcularInicioJanelaDeCursor(null, agora);
  assertEquals(inicio.toISOString(), "2026-06-29T12:00:00.000Z");
});

Deno.test("mapTaskStatusToOsStatus — mapeia taskStatus Auvo pro status inicial da OS", () => {
  assertEquals(mapTaskStatusToOsStatus(5), "finalizado");
  assertEquals(mapTaskStatusToOsStatus(2), "em_execucao");
  assertEquals(mapTaskStatusToOsStatus(3), "em_execucao");
  assertEquals(mapTaskStatusToOsStatus(4), "em_execucao");
  assertEquals(mapTaskStatusToOsStatus(1), "solicitacao");
  assertEquals(mapTaskStatusToOsStatus(6), "solicitacao");
  assertEquals(mapTaskStatusToOsStatus(undefined), "solicitacao");
});

Deno.test("montarDetalhes — E01-S38: só inclui chaves presentes, nunca inventa default", () => {
  assertEquals(
    montarDetalhes({ address: "Rua Exemplo, 123", latitude: -22.9, longitude: -47.0, priority: 3 }),
    { address: "Rua Exemplo, 123", latitude: -22.9, longitude: -47.0, priority: 3 },
  );
  assertEquals(montarDetalhes({}), {});
});

Deno.test("montarDetalhes — E01-S38: captura todo o dado rico da tarefa (produtos, serviços, assinatura, etc.)", () => {
  // Payload real (2026-07-09), sem attachments/produtos/serviços preenchidos, pra confirmar que
  // arrays vazios não entram (só o que tem conteúdo real).
  assertEquals(
    montarDetalhes({
      address: "Avenida Doutor Manoel Afonso Ferreira, 400",
      latitude: -22.90857,
      longitude: -47.03647,
      priority: 3,
      userToName: "Davi Guedes",
      customerDescription: "H2 Sports Bar & Poker",
      orientation: "Início visita ",
      report: "Relato do técnico",
      pendency: "Peça em falta",
      duration: "00:05:10",
      durationDecimal: 0.086,
      expense: "0,00",
      signatureUrl: "https://auvo-producao.s3.amazonaws.com/anexos_tarefas/x.png",
      signatureName: "Adamar",
      attachments: [],
      products: [{ id: 1, nome: "Filtro" }],
      services: [],
      additionalCosts: [],
      summary: { totalProducts: 1, totalValue: 50 },
      ticketId: 42,
      ticketTitle: "Chamado central",
      taskUrl: "https://app.auvo.com.br/informacoes/tarefa/x",
    }),
    {
      address: "Avenida Doutor Manoel Afonso Ferreira, 400",
      latitude: -22.90857,
      longitude: -47.03647,
      priority: 3,
      tecnicoNomeAuvo: "Davi Guedes",
      clienteNomeAuvo: "H2 Sports Bar & Poker",
      orientacao: "Início visita ",
      relato: "Relato do técnico",
      pendencia: "Peça em falta",
      duracao: "00:05:10",
      duracaoHoras: 0.086,
      despesa: "0,00",
      assinaturaUrl: "https://auvo-producao.s3.amazonaws.com/anexos_tarefas/x.png",
      assinaturaNome: "Adamar",
      produtos: [{ id: 1, nome: "Filtro" }],
      resumo: { totalProducts: 1, totalValue: 50 },
      ticketId: 42,
      ticketTitulo: "Chamado central",
      taskUrl: "https://app.auvo.com.br/informacoes/tarefa/x",
    },
  );
});
