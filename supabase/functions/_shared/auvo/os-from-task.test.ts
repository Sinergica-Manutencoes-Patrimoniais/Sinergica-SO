import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  criarChamadoAutomatico,
  criarOsDaTarefa,
  marcarChamadoAutomaticoComOs,
  montarLinhaOs,
  proximosNumerosChamado,
  resolverClienteIdsPorAuvoIds,
  resolverFuncionarioIdsPorAuvoIds,
} from "./os-from-task.ts";

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

/** Stub mínimo do client Supabase — só o suficiente pra exercitar `criarOsDaTarefa` sem um
 * Postgres real. Cada `.from(table)` devolve um builder que registra a chamada e resolve com o
 * fixture configurado para aquela tabela; `.rpc(nome)` resolve a numeração do Chamado (E01-S99,
 * `fn_proximo_numero_chamado`/`fn_proximos_numeros_chamado`) — a OS em si nunca gera número
 * próprio, o CH-XXXX vem sempre do Chamado (trigger no banco, não simulável no stub). */
function fakeDb(fixtures: {
  cliente?: { id: string } | null;
  clientesBatch?: Array<{ id: string; auvo_id: number }>;
  funcionario?: { id: string } | null;
  funcionariosBatch?: Array<{ id: string; auvo_user_id: number }>;
  chamadoNumero?: string;
  chamadoNumeros?: string[];
  chamadoInseridoId?: string;
  usuarioSistema?: { user_id: string } | null;
  osInseridaId?: string;
}) {
  const calls: Call[] = [];
  return {
    calls,
    schema(_schema: string) {
      return {
        rpc(nome: string, args?: Record<string, unknown>) {
          calls.push({ table: "rpc", method: nome, args: [args] });
          if (nome === "fn_proximo_numero_chamado") {
            return Promise.resolve({ data: fixtures.chamadoNumero ?? "CH-0001", error: null });
          }
          if (nome === "fn_proximos_numeros_chamado") {
            return Promise.resolve({ data: fixtures.chamadoNumeros ?? [], error: null });
          }
          throw new Error(`rpc não mapeada no stub: ${nome}`);
        },
        from(table: string) {
          calls.push({ table, method: "from", args: [] });
          if (table === "clientes") {
            return {
              select: () => ({
                eq: () => ({
                  is: () => ({
                    maybeSingle: () => Promise.resolve({ data: fixtures.cliente ?? null, error: null }),
                  }),
                }),
                in: () => ({
                  is: () => Promise.resolve({ data: fixtures.clientesBatch ?? [], error: null }),
                }),
              }),
            };
          }
          if (table === "funcionarios") {
            return {
              select: () => ({
                eq: () => ({
                  is: () => ({
                    maybeSingle: () =>
                      Promise.resolve({ data: fixtures.funcionario ?? null, error: null }),
                  }),
                }),
                in: () => ({
                  is: () => Promise.resolve({ data: fixtures.funcionariosBatch ?? [], error: null }),
                }),
              }),
            };
          }
          if (table === "chamados") {
            return {
              insert: (row: Record<string, unknown>) => {
                calls.push({ table, method: "insert", args: [row] });
                return {
                  select: () => ({
                    single: () =>
                      Promise.resolve({
                        data: {
                          id: fixtures.chamadoInseridoId ?? "chamado-novo-1",
                          numero: fixtures.chamadoNumero ?? "CH-0001",
                        },
                        error: null,
                      }),
                  }),
                };
              },
              update: (row: Record<string, unknown>) => {
                calls.push({ table, method: "update", args: [row] });
                return { eq: () => Promise.resolve({ error: null }) };
              },
            };
          }
          if (table === "chamados_eventos") {
            return {
              insert: (row: Record<string, unknown>) => {
                calls.push({ table, method: "insert", args: [row] });
                return Promise.resolve({ error: null });
              },
            };
          }
          if (table === "ordens_servico") {
            return {
              insert: (row: Record<string, unknown>) => {
                calls.push({ table, method: "insert", args: [row] });
                return {
                  select: () => ({
                    single: () =>
                      Promise.resolve({ data: { id: fixtures.osInseridaId ?? "os-nova-1" }, error: null }),
                  }),
                };
              },
            };
          }
          if (table === "usuarios") {
            return {
              select: () => ({
                eq: () => ({
                  in: () => ({
                    order: () => ({
                      order: () => ({
                        limit: () => ({
                          maybeSingle: () =>
                            Promise.resolve({ data: fixtures.usuarioSistema ?? null, error: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          throw new Error(`tabela não mapeada no stub: ${table}`);
          // deno-lint-ignore no-unreachable
        },
        // deno-lint-ignore no-explicit-any
      } as any;
    },
  };
}

Deno.test("criarOsDaTarefa — cliente resolvido cria Chamado automático + OS e devolve id/status", async () => {
  const db = fakeDb({
    cliente: { id: "cliente-1" },
    chamadoNumero: "CH-0007",
    chamadoInseridoId: "chamado-novo-1",
    usuarioSistema: { user_id: "user-sistema-1" },
    osInseridaId: "os-nova-1",
  });
  const resultado = await criarOsDaTarefa(db as never, {
    taskId: 999,
    titulo: "Vazamento na caixa d'água",
    customerId: 501,
    status: "solicitacao",
  });
  assertEquals(resultado, { id: "os-nova-1", status: "solicitacao" });
  const chamadoInsert = db.calls.find((c) => c.table === "chamados" && c.method === "insert");
  assertEquals((chamadoInsert?.args[0] as Record<string, unknown>).origem, "auvo_sync");
  const osInsert = db.calls.find((c) => c.table === "ordens_servico" && c.method === "insert");
  assertEquals((osInsert?.args[0] as Record<string, unknown>).chamado_id, "chamado-novo-1");
  assertEquals("numero" in (osInsert?.args[0] as Record<string, unknown>), false);
  const chamadoUpdate = db.calls.find((c) => c.table === "chamados" && c.method === "update");
  assertEquals((chamadoUpdate?.args[0] as Record<string, unknown>).status, "convertido_os");
  assertEquals((chamadoUpdate?.args[0] as Record<string, unknown>).ordem_servico_id, "os-nova-1");
});

Deno.test("criarOsDaTarefa — cliente não sincronizado devolve null sem lançar (AC-4)", async () => {
  const db = fakeDb({ cliente: null });
  const resultado = await criarOsDaTarefa(db as never, {
    taskId: 999,
    titulo: "Vazamento na caixa d'água",
    customerId: 501,
    status: "solicitacao",
  });
  assertEquals(resultado, null);
});

Deno.test("criarChamadoAutomatico — E01-S99: cria Chamado origem=auvo_sync e registra evento", async () => {
  const db = fakeDb({ chamadoNumero: "CH-0042", chamadoInseridoId: "chamado-1" });
  const resultado = await criarChamadoAutomatico(db as never, {
    clienteId: "cliente-1",
    titulo: "Vazamento",
    systemUserId: "user-sistema-1",
  });
  assertEquals(resultado, { id: "chamado-1", numero: "CH-0042" });
  assertEquals(db.calls.some((c) => c.table === "rpc" && c.method === "fn_proximo_numero_chamado"), true);
  assertEquals(db.calls.some((c) => c.table === "chamados_eventos" && c.method === "insert"), true);
});

Deno.test("marcarChamadoAutomaticoComOs — fecha o ciclo (status + ordem_servico_id + evento)", async () => {
  const db = fakeDb({});
  await marcarChamadoAutomaticoComOs(db as never, "chamado-1", "os-1");
  const update = db.calls.find((c) => c.table === "chamados" && c.method === "update");
  assertEquals((update?.args[0] as Record<string, unknown>).status, "convertido_os");
  assertEquals((update?.args[0] as Record<string, unknown>).ordem_servico_id, "os-1");
  assertEquals(db.calls.some((c) => c.table === "chamados_eventos" && c.method === "insert"), true);
});

Deno.test("proximosNumerosChamado — E01-S99: reserva N números numa chamada só; 0/negativo não chama a RPC", async () => {
  const db = fakeDb({ chamadoNumeros: ["CH-0010", "CH-0011", "CH-0012"] });
  assertEquals(await proximosNumerosChamado(db as never, 3), ["CH-0010", "CH-0011", "CH-0012"]);

  const dbVazio = fakeDb({});
  assertEquals(await proximosNumerosChamado(dbVazio as never, 0), []);
  assertEquals(dbVazio.calls.length, 0);
});

Deno.test("montarLinhaOs — monta a linha sem I/O, referenciando o Chamado, sem numero próprio", () => {
  const linha = montarLinhaOs(
    { taskId: 999, titulo: "Vazamento", customerId: 501, status: "em_execucao" },
    { clienteId: "cliente-1", chamadoId: "chamado-1", systemUserId: "user-sistema-1" },
  );
  const { auvo_synced_at, ...resto } = linha;
  assertEquals(resto, {
    client_id: "cliente-1",
    chamado_id: "chamado-1",
    titulo: "Vazamento",
    categoria: "corretiva",
    status: "em_execucao",
    origem: "auvo",
    origem_ref_id: "999",
    auvo_task_id: 999,
    auvo_sync_status: "synced",
    created_by: "user-sistema-1",
    tecnico_auvo_user_id: null,
    tecnico_funcionario_id: null,
    data_agendada: null,
    check_in_at: null,
    check_out_at: null,
    auvo_detalhes: null,
  });
  assertEquals(typeof auvo_synced_at, "string");
  assertEquals(Number.isNaN(Date.parse(auvo_synced_at as string)), false);
});

Deno.test("montarLinhaOs — E01-S38: inclui técnico/data agendada/check-in-out/detalhes quando presentes", () => {
  const linha = montarLinhaOs(
    {
      taskId: 999,
      titulo: "Vazamento",
      customerId: 501,
      status: "em_execucao",
      tecnicoAuvoUserId: 153005,
      dataAgendada: "2026-06-25T08:00:00",
      checkInAt: "2026-06-25T07:49:38",
      checkOutAt: "2026-06-25T07:54:48",
      detalhes: { address: "Rua Exemplo, 123", priority: 3 },
    },
    {
      clienteId: "cliente-1",
      chamadoId: "chamado-1",
      systemUserId: "user-sistema-1",
      tecnicoFuncionarioId: "funcionario-1",
    },
  );
  assertEquals(linha.tecnico_auvo_user_id, 153005);
  assertEquals(linha.tecnico_funcionario_id, "funcionario-1");
  assertEquals(linha.data_agendada, "2026-06-25T08:00:00");
  assertEquals(linha.check_in_at, "2026-06-25T07:49:38");
  assertEquals(linha.check_out_at, "2026-06-25T07:54:48");
  assertEquals(linha.auvo_detalhes, { address: "Rua Exemplo, 123", priority: 3 });
});

Deno.test("resolverFuncionarioIdsPorAuvoIds — resolve em lote e dedup, sem query pra lista vazia", async () => {
  const db = fakeDb({
    funcionariosBatch: [
      { id: "funcionario-1", auvo_user_id: 153005 },
      { id: "funcionario-2", auvo_user_id: 152741 },
    ],
  });
  const mapa = await resolverFuncionarioIdsPorAuvoIds(db as never, [153005, 153005, 152741]);
  assertEquals(mapa.get(153005), "funcionario-1");
  assertEquals(mapa.get(152741), "funcionario-2");
  assertEquals(mapa.size, 2);

  const mapaVazio = await resolverFuncionarioIdsPorAuvoIds(db as never, []);
  assertEquals(mapaVazio.size, 0);
});

Deno.test("criarOsDaTarefa — E01-S38: resolve técnico quando tecnicoAuvoUserId presente", async () => {
  const db = fakeDb({
    cliente: { id: "cliente-1" },
    funcionario: { id: "funcionario-1" },
    chamadoNumero: "CH-0007",
    chamadoInseridoId: "chamado-novo-1",
    usuarioSistema: { user_id: "user-sistema-1" },
    osInseridaId: "os-nova-1",
  });
  const resultado = await criarOsDaTarefa(db as never, {
    taskId: 999,
    titulo: "Vazamento na caixa d'água",
    customerId: 501,
    status: "solicitacao",
    tecnicoAuvoUserId: 153005,
  });
  assertEquals(resultado, { id: "os-nova-1", status: "solicitacao" });
  const insertCall = db.calls.find((c) => c.table === "ordens_servico" && c.method === "insert");
  assertEquals(
    (insertCall?.args[0] as Record<string, unknown>).tecnico_funcionario_id,
    "funcionario-1",
  );
});

Deno.test("resolverClienteIdsPorAuvoIds — resolve em lote e dedup, sem query pra lista vazia", async () => {
  const db = fakeDb({
    clientesBatch: [
      { id: "cliente-1", auvo_id: 501 },
      { id: "cliente-2", auvo_id: 502 },
    ],
  });
  const mapa = await resolverClienteIdsPorAuvoIds(db as never, [501, 501, 502]);
  assertEquals(mapa.get(501), "cliente-1");
  assertEquals(mapa.get(502), "cliente-2");
  assertEquals(mapa.size, 2);

  const mapaVazio = await resolverClienteIdsPorAuvoIds(db as never, []);
  assertEquals(mapaVazio.size, 0);
});
