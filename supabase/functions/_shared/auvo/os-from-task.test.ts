import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarOsDaTarefa } from "./os-from-task.ts";

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
