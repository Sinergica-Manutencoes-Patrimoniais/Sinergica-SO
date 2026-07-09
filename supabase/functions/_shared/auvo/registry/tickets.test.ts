import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ticketsDescriptor } from "./tickets.ts";

Deno.test("ticketsDescriptor — webhook em tempo real, sem DELETE", () => {
  assertEquals(ticketsDescriptor.auvoBasePath, "/tickets");
  assertEquals(ticketsDescriptor.webhookEntity, 62);
  assertEquals(ticketsDescriptor.deleteStrategy, "unsupported");
});

Deno.test("ticketsDescriptor — E01-S34: cron horário como rede de segurança do webhook", () => {
  assertEquals(ticketsDescriptor.cronSchedule, "0 * * * *");
});

Deno.test("ticketsDescriptor — listParamFilter cobre janela ampla (10 anos passado a 2 futuro)", () => {
  // Confirmado direto na API real (2026-07-08): GET /tickets sem StartDate/EndDate dá 400
  // "Invalid Date". pcm-auvo-pull usa este filtro pra toda listagem deste recurso.
  const filtro = ticketsDescriptor.listParamFilter?.();
  const inicio = new Date(String(filtro?.StartDate));
  const fim = new Date(String(filtro?.EndDate));
  const agora = new Date();
  const dezAnosAtras = new Date(agora);
  dezAnosAtras.setFullYear(dezAnosAtras.getFullYear() - 10);
  const doisAnosNoFuturo = new Date(agora);
  doisAnosNoFuturo.setFullYear(doisAnosNoFuturo.getFullYear() + 2);
  // Tolerância de 1 dia (execução do teste não é instantânea ao cálculo do descriptor).
  const UM_DIA_MS = 24 * 60 * 60 * 1000;
  assertEquals(Math.abs(inicio.getTime() - dezAnosAtras.getTime()) < UM_DIA_MS, true);
  assertEquals(Math.abs(fim.getTime() - doisAnosNoFuturo.getTime()) < UM_DIA_MS, true);
});

Deno.test("ticketsDescriptor — toAuvo (create) inclui todos os campos suportados", () => {
  assertEquals(
    ticketsDescriptor.toAuvo({
      id: "33000000-0000-0000-0000-000000000001",
      titulo: "Ar-condicionado com vazamento",
      descricao: "Cliente relatou vazamento na unidade 3",
      cliente_auvo_id: 501,
      equipe_auvo_id: 12,
      responsavel_auvo_user_id: 77,
      prioridade: 2,
      request_type_id: 4,
      status_id: 1,
    }),
    {
      title: "Ar-condicionado com vazamento",
      description: "Cliente relatou vazamento na unidade 3",
      customerId: 501,
      teamId: 12,
      userResponsableId: 77,
      priority: 2,
      requestTypeId: 4,
      statusId: 1,
    },
  );
});

Deno.test("ticketsDescriptor — toAuvoUpdate (PATCH) contém só statusId, nunca título/descrição", () => {
  assertEquals(
    ticketsDescriptor.toAuvoUpdate?.({
      id: "33000000-0000-0000-0000-000000000001",
      titulo: "Título editado só localmente",
      descricao: "Descrição editada só localmente",
      status_id: 3,
    }),
    { statusId: 3 },
  );
});

Deno.test("ticketsDescriptor — inbound mapeia customerId/teamId como ids denormalizados", () => {
  assertEquals(
    ticketsDescriptor.fromAuvo({
      id: 890,
      title: "Chamado via central",
      description: "Descrição do Auvo",
      customerId: 501,
      teamId: 12,
      userResponsableId: 77,
      priority: 3,
      requestTypeId: 4,
      statusId: 2,
    }),
    {
      titulo: "Chamado via central",
      descricao: "Descrição do Auvo",
      cliente_auvo_id: 501,
      equipe_auvo_id: 12,
      responsavel_auvo_user_id: 77,
      prioridade: 3,
      request_type_id: 4,
      status_id: 2,
    },
  );
});
