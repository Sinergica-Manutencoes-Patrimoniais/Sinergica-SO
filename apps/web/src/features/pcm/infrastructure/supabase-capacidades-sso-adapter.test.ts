import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabaseCapacidadesSsoAdapter } from "./supabase-capacidades-sso-adapter";

const command = {
  requestId: "17010000-0000-0000-0000-000000000101",
  expectedRevision: 0,
  usuarioId: "17010000-0000-0000-0000-000000000002",
  perfilId: null,
  acao: "plano.gerir" as const,
  clienteId: "17010000-0000-0000-0000-00000000000a",
  ativa: true,
  motivo: "Responsabilidade PCM",
};

describe("adapter de capacidades", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.schema.mockReturnValue({ rpc: api.rpc });
  });
  it("mapeia o envelope e o motivo para a RPC transacional", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: command.usuarioId,
        revision: 1,
        state: true,
        created: true,
        linkedIds: {},
        warnings: [],
        requestId: command.requestId,
      },
      error: null,
    });
    expect((await supabaseCapacidadesSsoAdapter.definirConcessao(command)).revision).toBe(1);
    expect(api.schema).toHaveBeenCalledWith("config");
    expect(api.rpc).toHaveBeenCalledWith("sso_definir_concessao", {
      p_request_id: command.requestId,
      p_expected_revision: 0,
      p_usuario_id: command.usuarioId,
      p_perfil_id: null,
      p_acao: "plano.gerir",
      p_cliente_id: command.clienteId,
      p_ativa: true,
      p_motivo: command.motivo,
    });
  });
  it("não transforma falha do banco em autorização", async () => {
    api.rpc.mockResolvedValue({ data: null, error: new Error("acesso negado") });
    await expect(
      supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", command.clienteId),
    ).rejects.toThrow("acesso negado");
  });
  it("rejeita resposta incompleta em vez de inferir sucesso", async () => {
    api.rpc.mockResolvedValue({ data: { revision: 1 }, error: null });
    await expect(supabaseCapacidadesSsoAdapter.definirConcessao(command)).rejects.toThrow();
  });
  it("encaminha separadamente a autorização de dois Clientes e rejeita erro de escopo", async () => {
    const outro = "17020000-0000-4000-8000-00000000000b";
    const negado = { code: "42501", message: "sem acesso" };
    api.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: null, error: negado });
    await expect(supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", command.clienteId)).resolves.toBe(true);
    await expect(supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", outro)).rejects.toEqual(negado);
    expect(api.rpc).toHaveBeenNthCalledWith(1, "sso_autorizar_acao", { p_acao: "plano.gerir", p_cliente_id: command.clienteId });
    expect(api.rpc).toHaveBeenNthCalledWith(2, "sso_autorizar_acao", { p_acao: "plano.gerir", p_cliente_id: outro });
  });
  it("propaga conflito e encaminha novamente o mesmo pedido sem inventar rollback", async () => {
    const conflito = { code: "40001", message: "revisão obsoleta" };
    api.rpc.mockResolvedValueOnce({ data: null, error: conflito }).mockResolvedValueOnce({ data: null, error: conflito });
    await expect(supabaseCapacidadesSsoAdapter.definirConcessao(command)).rejects.toEqual(conflito);
    await expect(supabaseCapacidadesSsoAdapter.definirConcessao(command)).rejects.toEqual(conflito);
    expect(api.rpc).toHaveBeenCalledTimes(2);
    expect(api.rpc.mock.calls[0]).toEqual(api.rpc.mock.calls[1]);
    // Mock comprova somente transporte. Rollback e concorrência exigem banco e duas sessões.
  });

});
