import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, schema } = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema } }));
import { supabasePlanoManutencaoAdapter } from "./supabase-plano-manutencao-adapter";

const id = "16530000-0000-4000-8000-000000000001";
const comando = { requestId: id, expectedRevision: 1, planoId: id, vigencia: "2026-01-01" };
const recibo = { aggregateId: id, revision: 2, state: "aprovado", created: false, linkedIds: {}, warnings: [], requestId: id };

describe("adapter S165", () => {
  beforeEach(() => { rpc.mockReset(); schema.mockReset(); schema.mockReturnValue({ rpc }); });
  it("encaminha aprovação e retorna recibo do servidor", async () => {
    rpc.mockResolvedValue({ data: recibo, error: null });
    await expect(supabasePlanoManutencaoAdapter.aprovarPlano(comando)).resolves.toEqual(recibo);
    expect(schema).toHaveBeenCalledWith("pcm");
    expect(rpc).toHaveBeenCalledWith("sso_aprovar_plano", { p_request_id: id, p_expected_revision: 1, p_plano_id: id, p_vigencia: "2026-01-01" });
  });
  it("não converte autorização negada ou recibo incompleto em sucesso", async () => {
    const erro = { code: "42501", message: "sem_acesso" };
    rpc.mockResolvedValueOnce({ data: null, error: erro }).mockResolvedValueOnce({ data: { requestId: id }, error: null });
    await expect(supabasePlanoManutencaoAdapter.aprovarPlano(comando)).rejects.toEqual(erro);
    await expect(supabasePlanoManutencaoAdapter.aprovarPlano(comando)).rejects.toThrow();
  });
});
