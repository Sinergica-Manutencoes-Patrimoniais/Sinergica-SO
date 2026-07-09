import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  contarOsExistentes,
  criarOsDaTarefa,
  formatarNumeroOs,
  montarLinhaOs,
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
 * fixture configurado para aquela tabela. */
function fakeDb(fixtures: {
  cliente?: { id: string } | null;
  clientesBatch?: Array<{ id: string; auvo_id: number }>;
  funcionario?: { id: string } | null;
  funcionariosBatch?: Array<{ id: string; auvo_user_id: number }>;
  osCount?: number;
  usuarioSistema?: { user_id: string } | null;
  osInseridaId?: string;
}) {
  const calls: Call[] = [];
  return {
    calls,
    schema(_schema: string) {
      return {
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
          if (table === "ordens_servico") {
            return {
              select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.count === "exact" && opts.head) {
                  return Promise.resolve({ count: fixtures.osCount ?? 0, error: null });
                }
                return {
                  single: () =>
                    Promise.resolve({
                      data: { id: fixtures.osInseridaId ?? "os-nova-1" },
                      error: null,
                    }),
                };
              },
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

Deno.test("criarOsDaTarefa — cliente resolvido cria a OS e devolve id/status", async () => {
  const db = fakeDb({
    cliente: { id: "cliente-1" },
    osCount: 6,
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

Deno.test("formatarNumeroOs — preenche com zero à esquerda até 3 dígitos", () => {
  assertEquals(formatarNumeroOs(1), "CH-001");
  assertEquals(formatarNumeroOs(42), "CH-042");
  assertEquals(formatarNumeroOs(1234), "CH-1234");
});

Deno.test("montarLinhaOs — monta a linha sem I/O, mesmo formato de criarOsDaTarefa", () => {
  const linha = montarLinhaOs(
    { taskId: 999, titulo: "Vazamento", customerId: 501, status: "em_execucao" },
    { clienteId: "cliente-1", numero: "CH-007", systemUserId: "user-sistema-1" },
  );
  const { auvo_synced_at, ...resto } = linha;
  assertEquals(resto, {
    client_id: "cliente-1",
    numero: "CH-007",
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
      numero: "CH-007",
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
    osCount: 6,
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
  const insertCall = db.calls.find((c) => c.method === "insert");
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

Deno.test("contarOsExistentes — devolve a contagem via count/head, 0 se ausente", async () => {
  const db = fakeDb({ osCount: 41 });
  assertEquals(await contarOsExistentes(db as never), 41);

  const dbSemCount = fakeDb({});
  assertEquals(await contarOsExistentes(dbSemCount as never), 0);
});
