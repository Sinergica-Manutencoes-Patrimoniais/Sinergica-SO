import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn(), abortSignal: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { obterPaginaSnapshotExportacao } from "./supabase-snapshot-exportacao";

beforeEach(() => { vi.resetAllMocks(); api.schema.mockReturnValue({ rpc: api.rpc }); });

it("consulta RPC mediada por Cliente, Plano, versão e posição com cancelamento", async () => {
  const signal = new AbortController().signal;
  api.rpc.mockReturnValue({ abortSignal: api.abortSignal });
  api.abortSignal.mockResolvedValue({ data: { total: 0 }, error: null });
  expect(await obterPaginaSnapshotExportacao({ clienteId: "c", planoId: "p", versaoId: "v" }, 100, signal)).toEqual({ total: 0 });
  expect(api.schema).toHaveBeenCalledWith("pcm");
  expect(api.rpc).toHaveBeenCalledWith("sso_snapshot_exportacao_conferido", { p_cliente_id: "c", p_plano_id: "p", p_versao_id: "v", p_posicao: 100, p_limite: 100 });
  expect(api.abortSignal).toHaveBeenCalledWith(signal);
});

it("propaga recusa do servidor sem retornar dados", async () => {
  api.rpc.mockResolvedValue({ data: null, error: new Error("sem_acesso") });
  await expect(obterPaginaSnapshotExportacao({ clienteId: "c", planoId: "p", versaoId: "v" }, 0)).rejects.toThrow("sem_acesso");
});
