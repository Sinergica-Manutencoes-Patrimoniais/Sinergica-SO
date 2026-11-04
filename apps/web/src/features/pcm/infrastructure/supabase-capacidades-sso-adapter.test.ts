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
});
