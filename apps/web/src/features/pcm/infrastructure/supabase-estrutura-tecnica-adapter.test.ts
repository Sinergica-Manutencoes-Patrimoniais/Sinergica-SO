import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: supabaseMock.schema } }));

import { supabaseEstruturaTecnicaAdapter as adapter } from "./supabase-estrutura-tecnica-adapter";

const ids = {
  request: "17600000-0000-4000-8000-000000000001",
  group: "17600000-0000-4000-8000-000000000002",
  local: "17600000-0000-4000-8000-000000000003",
  category: "17600000-0000-4000-8000-000000000004",
  system: "17600000-0000-4000-8000-000000000005",
  client: "17600000-0000-4000-8000-000000000006",
  actor: "17600000-0000-4000-8000-000000000007",
};

function resultBuilder(data: unknown, error: unknown = null) {
  const promise = Promise.resolve({ data, error });
  return Object.assign(promise, {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
  });
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    aggregateId: ids.group,
    revision: 1,
    state: true,
    created: true,
    linkedIds: { clienteId: ids.client, localId: ids.local, sistemaId: ids.system },
    warnings: [],
    requestId: ids.request,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  supabaseMock.schema.mockReturnValue({ rpc: supabaseMock.rpc, from: supabaseMock.from });
});

describe("supabaseEstruturaTecnicaAdapter — E01-S176", () => {
  it("mapeia grupo e movimentação para RPCs canônicas com requestId e revisão", async () => {
    supabaseMock.rpc.mockReturnValue(resultBuilder(receipt()));
    const grupo = {
      requestId: ids.request,
      expectedRevision: 0,
      grupoId: ids.group,
      localId: ids.local,
      categoriaId: ids.category,
      sistemaId: ids.system,
      nome: "Luminárias",
      quantidade: 20,
      caracteristicas: { Potência: "12 W" },
    };
    await expect(adapter.salvarGrupo(grupo)).resolves.toMatchObject({ aggregateId: ids.group, revision: 1 });
    expect(supabaseMock.schema).toHaveBeenCalledWith("pcm");
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, "sso_salvar_grupo_quantitativo", {
      p_request_id: ids.request,
      p_expected_revision: 0,
      p_grupo_id: ids.group,
      p_local_id: ids.local,
      p_categoria_id: ids.category,
      p_sistema_id: ids.system,
      p_nome: "Luminárias",
      p_quantidade: 20,
      p_caracteristicas: { Potência: "12 W" },
    });

    supabaseMock.rpc.mockReturnValue(resultBuilder(receipt({ aggregateId: ids.group, created: false })));
    await adapter.moverComponente({
      requestId: ids.request,
      expectedRevision: 4,
      componenteId: ids.group,
      areaId: ids.local,
      localId: ids.local,
      parentId: null,
    });
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(2, "sso_mover_componente", {
      p_request_id: ids.request,
      p_expected_revision: 4,
      p_id: ids.group,
      p_area_id: ids.local,
      p_local_id: ids.local,
      p_parent_id: null,
    });
  });

  it("propaga conflito/rollback do servidor e rejeita recibo fora do contrato", async () => {
    const conflict = { code: "40001", message: "revisão obsoleta" };
    supabaseMock.rpc.mockReturnValue(resultBuilder(null, conflict));
    await expect(adapter.salvarGrupo({
      requestId: ids.request, expectedRevision: 0, grupoId: ids.group, localId: ids.local,
      categoriaId: ids.category, sistemaId: null, nome: "Luminárias", quantidade: 20, caracteristicas: {},
    })).rejects.toBe(conflict);

    supabaseMock.rpc.mockReturnValue(resultBuilder({ ...receipt(), requestId: "request-inválido" }));
    await expect(adapter.salvarGrupo({
      requestId: ids.request, expectedRevision: 0, grupoId: ids.group, localId: ids.local,
      categoriaId: ids.category, sistemaId: null, nome: "Luminárias", quantidade: 20, caracteristicas: {},
    })).rejects.toThrow();
  });

  it("página destinos com abort signal e valida a forma da resposta", async () => {
    const signal = new AbortController().signal;
    const builder = resultBuilder([{ id: ids.local, nome: "Hall", area_id: ids.local }]);
    supabaseMock.rpc.mockReturnValue(builder);
    await expect(adapter.listarDestinos(ids.client, "local", 20, null, "Hall", signal)).resolves.toEqual([
      { id: ids.local, nome: "Hall", areaId: ids.local },
    ]);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("sso_listar_destinos_estrutura", {
      p_cliente_id: ids.client,
      p_tipo: "local",
      p_limite: 20,
      p_apos: null,
      p_busca: "Hall",
    });
    expect(builder.abortSignal).toHaveBeenCalledWith(signal);
    await expect(adapter.listarDestinos(ids.client, "local", 101, null, null)).rejects.toThrow(
      "Paginação inválida.",
    );
  });

  it("isola grupos por Cliente, pagina, filtra Sistema e normaliza snake_case", async () => {
    const signal = new AbortController().signal;
    const builder = resultBuilder([{
      id: ids.group,
      cliente_id: ids.client,
      local_id: ids.local,
      categoria_id: ids.category,
      sistema_id: ids.system,
      nome: "Luminárias",
      quantidade: 20,
      caracteristicas: { Potência: "12 W" },
      revisao: 3,
    }]);
    supabaseMock.from.mockReturnValue(builder);
    await expect(adapter.listarGrupos(ids.client, 50, 50, signal, ids.system)).resolves.toEqual([{
      id: ids.group,
      clienteId: ids.client,
      localId: ids.local,
      categoriaId: ids.category,
      sistemaId: ids.system,
      nome: "Luminárias",
      quantidade: 20,
      caracteristicas: { Potência: "12 W" },
      revisao: 3,
    }]);
    expect(supabaseMock.from).toHaveBeenCalledWith("grupos_quantitativos");
    expect(builder.select).toHaveBeenCalledWith(
      "id,cliente_id,local_id,categoria_id,sistema_id,nome,quantidade,caracteristicas,revisao",
    );
    expect(builder.eq).toHaveBeenCalledWith("cliente_id", ids.client);
    expect(builder.eq).toHaveBeenCalledWith("ativo", true);
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.eq).toHaveBeenCalledWith("sistema_id", ids.system);
    expect(builder.range).toHaveBeenCalledWith(50, 99);
    expect(builder.abortSignal).toHaveBeenCalledWith(signal);
  });

  it("usa cursor composto na consulta de histórico e valida tipos", async () => {
    const builder = resultBuilder([{
      evento_id: ids.actor,
      ocorrido_em: "2026-10-26T10:00:00Z",
      acao: "estrutura.movimentada",
      ator_id: ids.actor,
      antes: { localId: "local-a" },
      depois: { localId: ids.local },
    }]);
    supabaseMock.rpc.mockReturnValue(builder);
    await expect(adapter.listarHistorico("componente", ids.group, 20, {
      data: "2026-10-27T10:00:00Z", id: ids.actor,
    })).resolves.toMatchObject([{ id: ids.actor, acao: "estrutura.movimentada", atorId: ids.actor }]);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("sso_listar_historico_estrutura", {
      p_tipo: "componente", p_id: ids.group, p_limite: 20,
      p_antes: "2026-10-27T10:00:00Z", p_antes_id: ids.actor,
    });
  });
});
