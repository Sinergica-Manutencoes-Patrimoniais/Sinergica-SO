import { expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn(), abortSignal: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { obterPaginaCronograma } from "./supabase-fonte-cronograma";

it("consulta fonte parcial com cursor e preserva estado da Visita", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockReturnValue({ abortSignal: api.abortSignal });
  api.abortSignal.mockResolvedValue({ data: [{ tipo: "visita", id: "i", cliente_id: "c", plano_id: "p", versao_id: "v", rotina_id: "r", alvo_id: "a", vencimento_original: "2026-12-25", data_programada: null, visita_estado: "cancelada", visita_revisao: 4, snapshot_hash: "hash", completude: "desconhecida" }], error: null });
  const signal = new AbortController().signal;
  const itens = await obterPaginaCronograma({ clienteId: "c", planoId: "p", versaoId: "v", inicio: "2026-12-01", fim: "2027-01-31" }, { tipo: "calendario", id: "anterior" }, signal);
  expect(itens).toEqual([{ tipo: "visita", id: "i", clienteId: "c", planoId: "p", versaoId: "v", rotinaId: "r", alvoId: "a", vencimentoOriginal: "2026-12-25", dataProgramada: null, visitaEstado: "cancelada", visitaRevisao: 4, snapshotHash: "hash", completude: "desconhecida" }]);
  expect(api.rpc).toHaveBeenCalledWith("sso_ocorrencias_cronograma_conferidas", { p_cliente_id: "c", p_plano_id: "p", p_versao_id: "v", p_inicio: "2026-12-01", p_fim: "2027-01-31", p_apos_tipo: "calendario", p_apos_id: "anterior", p_limite: 100 });
  expect(api.abortSignal).toHaveBeenCalledWith(signal);
});
