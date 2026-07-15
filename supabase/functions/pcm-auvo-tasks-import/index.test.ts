import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calcularJanelaRolante,
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

Deno.test("calcularJanelaRolante — E01-S68: -21d/+60d a partir de agora, nunca depende do banco", () => {
  const agora = new Date("2026-07-13T12:00:00Z");
  const { inicio, fim } = calcularJanelaRolante(agora);
  assertEquals(inicio.toISOString(), "2026-06-22T12:00:00.000Z");
  assertEquals(fim.toISOString(), "2026-09-11T12:00:00.000Z");
});

Deno.test("calcularJanelaRolante — inclui tarefa de hoje mesmo com preventiva agendada bem no futuro", () => {
  // Reproduz o incidente de produção (2026-07-14): o cursor da E01-S67 pulava pra depois de uma
  // preventiva agendada e excluía o dia corrente. A janela rolante nunca depende de MAX(data
  // agendada) — sempre cobre "agora", independente do que já está no banco.
  const agora = new Date("2026-07-13T12:00:00Z");
  const { inicio, fim } = calcularJanelaRolante(agora);
  const hoje = new Date("2026-07-13T08:00:00Z");
  assertEquals(hoje >= inicio && hoje <= fim, true);
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

Deno.test("montarDetalhes — E01-S70: achata questionnaires[].answers[] em lista pergunta/resposta/data", () => {
  assertEquals(
    montarDetalhes({
      questionnaires: [
        {
          id: 1,
          name: "Checklist padrão",
          answers: [
            {
              questionId: 10,
              questionDescription: "Equipamento em condições de uso?",
              reply: "Sim",
              replyDate: "2026-07-13T08:30:00",
            },
            { questionId: 11, questionDescription: "Observações", reply: "" },
          ],
        },
      ],
    }),
    {
      questionarios: [
        {
          pergunta: "Equipamento em condições de uso?",
          resposta: "Sim",
          data: "2026-07-13T08:30:00",
        },
        { pergunta: "Observações", resposta: "", data: null },
      ],
    },
  );
});

Deno.test("montarDetalhes — E01-S70: sem questionnaires, keyWords ou timeControl não gera chaves vazias", () => {
  assertEquals(montarDetalhes({ questionnaires: [] }), {});
  assertEquals(montarDetalhes({ questionnaires: [{ answers: [] }] }), {});
  assertEquals(montarDetalhes({ keyWords: [] }), {});
});

Deno.test("montarDetalhes — E01-S70: keyWordsDescriptions, timeControl e financialCategory capturados", () => {
  assertEquals(
    montarDetalhes({
      keyWordsDescriptions: ["Urgente", "Preventiva"],
      timeControl: { totalMinutes: 45 },
      financialCategory: "Manutenção corretiva",
    }),
    {
      palavrasChave: ["Urgente", "Preventiva"],
      controleHoras: { totalMinutes: 45 },
      categoriaFinanceira: "Manutenção corretiva",
    },
  );
});

Deno.test("montarDetalhes — E01-S70: keyWords é fallback quando keyWordsDescriptions ausente", () => {
  assertEquals(montarDetalhes({ keyWords: [1, 2] }), { palavrasChave: [1, 2] });
});
