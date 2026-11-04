import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabaseEstruturaTecnicaAdapter } from "./supabase-estrutura-tecnica-adapter";

const comando = {
  requestId: "17610000-0000-4000-8000-000000000101",
  expectedRevision: 0,
  grupoId: "17610000-0000-4000-8000-000000000061",
  localId: "17610000-0000-4000-8000-000000000031",
  categoriaId: "17610000-0000-4000-8000-000000000041",
  sistemaId: null,
  nome: "Luminárias",
  quantidade: 20,
  caracteristicas: { potencia: "12 W" },
};

describe("adapter da estrutura técnica", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.schema.mockReturnValue({ rpc: api.rpc });
  });
  it("usa RPC única com revisão e requestId", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: comando.grupoId,
        revision: 1,
        state: true,
        created: true,
        linkedIds: { localId: comando.localId },
        warnings: [],
        requestId: comando.requestId,
      },
      error: null,
    });
    expect((await supabaseEstruturaTecnicaAdapter.salvarGrupo(comando)).revision).toBe(1);
    expect(api.schema).toHaveBeenCalledWith("pcm");
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith("sso_salvar_grupo_quantitativo", {
      p_request_id: comando.requestId,
      p_expected_revision: 0,
      p_grupo_id: comando.grupoId,
      p_local_id: comando.localId,
      p_categoria_id: comando.categoriaId,
      p_sistema_id: null,
      p_nome: comando.nome,
      p_quantidade: 20,
      p_caracteristicas: comando.caracteristicas,
    });
  });
  it("propaga erro do banco e rejeita resposta incompleta", async () => {
    api.rpc
      .mockResolvedValueOnce({ data: null, error: new Error("acesso negado") })
      .mockResolvedValueOnce({ data: { revision: 1 }, error: null });
    await expect(supabaseEstruturaTecnicaAdapter.salvarGrupo(comando)).rejects.toThrow(
      "acesso negado",
    );
    await expect(supabaseEstruturaTecnicaAdapter.salvarGrupo(comando)).rejects.toThrow();
  });
  it("consulta página limitada do Cliente e usa cancelamento", async () => {
    const controller = new AbortController();
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      abortSignal: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockReturnValue(query);
    query.abortSignal.mockResolvedValue({
      data: [
        {
          id: comando.grupoId,
          cliente_id: comando.grupoId,
          local_id: comando.localId,
          categoria_id: comando.categoriaId,
          sistema_id: null,
          nome: comando.nome,
          quantidade: 20,
          caracteristicas: comando.caracteristicas,
          revisao: 1,
        },
      ],
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);
    api.schema.mockReturnValue({ from });
    const grupos = await supabaseEstruturaTecnicaAdapter.listarGrupos(
      comando.grupoId,
      50,
      50,
      controller.signal,
    );
    expect(from).toHaveBeenCalledWith("grupos_quantitativos");
    expect(query.eq).toHaveBeenCalledWith("cliente_id", comando.grupoId);
    expect(query.range).toHaveBeenCalledWith(50, 99);
    expect(query.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(grupos[0]?.localId).toBe(comando.localId);
  });
  it("recusa paginação excessiva antes da consulta", async () => {
    await expect(
      supabaseEstruturaTecnicaAdapter.listarGrupos(comando.grupoId, 0, 101),
    ).rejects.toThrow();
    expect(api.schema).not.toHaveBeenCalled();
  });
  it("consulta histórico pelo cursor de data e evento sem acessar auditoria diretamente", async () => {
    api.rpc.mockResolvedValue({
      data: [
        {
          evento_id: comando.requestId,
          ocorrido_em: "2026-10-27T10:00:00+00:00",
          acao: "grupo.atualizado",
          ator_id: null,
          antes: { quantidade: 20 },
          depois: { quantidade: 21 },
        },
      ],
      error: null,
    });
    const resultado = await supabaseEstruturaTecnicaAdapter.listarHistorico(
      "grupo",
      comando.grupoId,
      20,
      {
        data: "2026-10-27T11:00:00+00:00",
        id: comando.requestId,
      },
    );
    expect(resultado[0]?.depois).toEqual({ quantidade: 21 });
    expect(api.rpc).toHaveBeenCalledWith("sso_listar_historico_estrutura", {
      p_tipo: "grupo",
      p_id: comando.grupoId,
      p_limite: 20,
      p_antes: "2026-10-27T11:00:00+00:00",
      p_antes_id: comando.requestId,
    });
  });
  it("envia movimentação e revisão ao comando autorizado no servidor", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: comando.grupoId,
        revision: 2,
        state: true,
        created: false,
        linkedIds: { localId: comando.localId },
        warnings: [],
        requestId: comando.requestId,
      },
      error: null,
    });
    const mover = {
      requestId: comando.requestId,
      expectedRevision: 1,
      componenteId: comando.grupoId,
      areaId: null,
      localId: null,
      parentId: null,
    };
    expect((await supabaseEstruturaTecnicaAdapter.moverComponente(mover)).revision).toBe(2);
    expect(api.rpc).toHaveBeenCalledWith("sso_mover_componente", {
      p_request_id: comando.requestId,
      p_expected_revision: 1,
      p_id: comando.grupoId,
      p_area_id: null,
      p_local_id: null,
      p_parent_id: null,
    });
  });
  it("consulta destinos paginados do Cliente com filtro literal", async () => {
    api.rpc.mockResolvedValue({
      data: [{ id: comando.localId, nome: "Salão", area_id: comando.grupoId }],
      error: null,
    });
    const destinos = await supabaseEstruturaTecnicaAdapter.listarDestinos(
      comando.grupoId,
      "local",
      20,
      null,
      "Salão",
    );
    expect(destinos).toEqual([{ id: comando.localId, nome: "Salão", areaId: comando.grupoId }]);
    expect(api.rpc).toHaveBeenCalledWith("sso_listar_destinos_estrutura", {
      p_cliente_id: comando.grupoId,
      p_tipo: "local",
      p_limite: 20,
      p_apos: null,
      p_busca: "Salão",
    });
  });
});
