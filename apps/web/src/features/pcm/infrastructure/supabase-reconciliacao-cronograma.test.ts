import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { listarCronogramasLegados, reconciliarCronogramaLegado } from "./supabase-reconciliacao-cronograma";

const clienteId = "00000000-0000-4000-8000-000000000001";
const loteId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const atorId = "00000000-0000-4000-8000-000000000004";
beforeEach(() => { api.schema.mockReset(); api.rpc.mockReset(); api.schema.mockReturnValue({ rpc: api.rpc }); });

it("consulta página validada e recusa resposta malformada", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: loteId, fonte_id: "Rimini", revisao: 2, criado_em: "2026-10-30T00:00:00Z", reconciliado: false }], error: null });
  expect(await listarCronogramasLegados(clienteId, null)).toEqual([{ id: loteId, fonte: "Rimini", revisao: 2, criadoEm: "2026-10-30T00:00:00Z", reconciliado: false }]);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_cronogramas_legados", { p_cliente_id: clienteId, p_apos: null, p_limite: 20 });
  api.rpc.mockResolvedValueOnce({ data: [{ id: loteId, revisao: 2 }], error: null });
  await expect(listarCronogramasLegados(clienteId, null)).rejects.toThrow();
});

it("envia pedido identificável e recusa confirmação de outro lote", async () => {
  const pedido = { requestId, clienteId, loteId, atorId, revisao: 2, motivo: "conferido" };
  api.rpc.mockResolvedValueOnce({ data: { aggregateId: loteId, revision: 2, state: "pendente", requestId }, error: null });
  await expect(reconciliarCronogramaLegado(pedido)).resolves.toBeUndefined();
  expect(api.rpc).toHaveBeenCalledWith("sso_reconciliar_cronograma_por_ator", { p_ator_id: atorId, p_request_id: requestId, p_lote_id: loteId, p_cliente_id: clienteId, p_revisao: 2, p_motivo: "conferido" });
  api.rpc.mockResolvedValueOnce({ data: { aggregateId: clienteId, revision: 2, state: "pendente", requestId }, error: null });
  await expect(reconciliarCronogramaLegado(pedido)).rejects.toThrow();
});
