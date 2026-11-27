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
    api.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: negado });
    await expect(
      supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", command.clienteId),
    ).resolves.toBe(true);
    await expect(supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", outro)).rejects.toEqual(
      negado,
    );
    expect(api.rpc).toHaveBeenNthCalledWith(1, "sso_autorizar_acao", {
      p_acao: "plano.gerir",
      p_cliente_id: command.clienteId,
    });
    expect(api.rpc).toHaveBeenNthCalledWith(2, "sso_autorizar_acao", {
      p_acao: "plano.gerir",
      p_cliente_id: outro,
    });
  });
  it("propaga conflito e encaminha novamente o mesmo pedido sem inventar rollback", async () => {
    const conflito = { code: "40001", message: "revisão obsoleta" };
    api.rpc
      .mockResolvedValueOnce({ data: null, error: conflito })
      .mockResolvedValueOnce({ data: null, error: conflito });
    await expect(supabaseCapacidadesSsoAdapter.definirConcessao(command)).rejects.toEqual(conflito);
    await expect(supabaseCapacidadesSsoAdapter.definirConcessao(command)).rejects.toEqual(conflito);
    expect(api.rpc).toHaveBeenCalledTimes(2);
    expect(api.rpc.mock.calls[0]).toEqual(api.rpc.mock.calls[1]);
    // Mock comprova somente transporte. Rollback e concorrência exigem banco e duas sessões.
  });

  // DEF-24: `concessaoSchema.acao` é `z.enum(ACOES_SSO)` e a listagem faz `z.array(...).parse`.
  // Uma única concessão de ação que o banco conhece e o front não derruba a página inteira de
  // concessões — "falha ao consultar", repetível no botão de recuperação, sem erro do servidor.
  it("lista concessão de ação criada por migration recente (DEF-24)", async () => {
    api.rpc.mockResolvedValue({
      data: [
        {
          id: "17030000-0000-4000-8000-000000000001",
          usuario_id: "17030000-0000-4000-8000-000000000002",
          perfil_id: null,
          acao: "execucao.contingencia_auvo",
          cliente_id: "17030000-0000-4000-8000-00000000000a",
          ativa: true,
          revisao: 1,
        },
      ],
      error: null,
    });
    const concessoes = await supabaseCapacidadesSsoAdapter.listarConcessoes({
      inicio: 0,
      limite: 20,
    });
    expect(concessoes).toHaveLength(1);
    expect(concessoes[0]?.acao).toBe("execucao.contingencia_auvo");
  });

  it("uma concessão ilegível não pode derrubar a página inteira de concessões", async () => {
    api.rpc.mockResolvedValue({
      data: [
        {
          id: "17030000-0000-4000-8000-000000000003",
          usuario_id: null,
          perfil_id: "17030000-0000-4000-8000-000000000004",
          acao: "acao.que.nao.existe",
          cliente_id: null,
          ativa: true,
          revisao: 1,
        },
      ],
      error: null,
    });
    // Documenta o comportamento atual: ação desconhecida ainda rejeita a página. O gate
    // `scripts/check-acoes-sso.mjs` impede que o front fique para trás do banco de novo.
    await expect(
      supabaseCapacidadesSsoAdapter.listarConcessoes({ inicio: 0, limite: 20 }),
    ).rejects.toThrow();
  });
});
