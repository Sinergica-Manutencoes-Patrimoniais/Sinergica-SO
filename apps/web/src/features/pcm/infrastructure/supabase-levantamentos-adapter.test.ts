import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabaseLevantamentosAdapter } from "./supabase-levantamentos-adapter";

beforeEach(() => {
  vi.resetAllMocks();
  api.schema.mockReturnValue({ rpc: api.rpc });
});
it("aceita recepção manual sem inventar origem declarada ou comprovada", async () => {
  api.rpc.mockResolvedValueOnce({
    data: [
      {
        id: "17810000-0000-4000-8000-000000000001",
        origem: "manual",
        chave_origem: "m1",
        revisao: 1,
        criado_em: "2026-10-27T00:00:00Z",
      },
    ],
    error: null,
  });
  expect(await supabaseLevantamentosAdapter.listarLotes("cliente", 20, null)).toMatchObject([
    { origem: "manual", chaveOrigem: "m1" },
  ]);
});
it("consulta lote no Cliente e converte contrato sem aceitar campos inesperados", async () => {
  api.rpc.mockResolvedValueOnce({
    data: [
      {
        id: "17810000-0000-4000-8000-000000000001",
        origem: "campo",
        chave_origem: "lote",
        revisao: 1,
        criado_em: "2026-10-27T00:00:00Z",
      },
    ],
    error: null,
  });
  const resultado = await supabaseLevantamentosAdapter.listarLotes("cliente", 20, null);
  expect(resultado[0]).toMatchObject({ origem: "campo", chaveOrigem: "lote" });
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_levantamentos", {
    p_cliente_id: "cliente",
    p_limite: 20,
    p_apos: null,
  });
  api.rpc.mockResolvedValueOnce({
    data: [
      {
        id: "17810000-0000-4000-8000-000000000001",
        origem: "campo",
        chave_origem: "lote",
        revisao: 1,
        criado_em: "2026-10-27T00:00:00Z",
        conteudo: "privado",
      },
    ],
    error: null,
  });
  await expect(supabaseLevantamentosAdapter.listarLotes("cliente", 20, null)).rejects.toThrow();
});
it("propaga recusa e cancelamento, sem transformar em lista vazia", async () => {
  const signal = new AbortController().signal;
  const abortSignal = vi.fn().mockResolvedValue({ data: null, error: new Error("sem acesso") });
  api.rpc.mockReturnValue({ abortSignal });
  await expect(
    supabaseLevantamentosAdapter.listarLinhas("cliente", "lote", 20, null, signal),
  ).rejects.toThrow("sem acesso");
  expect(abortSignal).toHaveBeenCalledWith(signal);
});

it("valida campos das linhas e recusa anexos não previstos", async () => {
  api.rpc.mockResolvedValueOnce({
    data: [{ chave: "linha", tipo: "sistema", atributos: { nome: "Provisório", quantidade: 2 } }],
    error: null,
  });
  expect(
    await supabaseLevantamentosAdapter.listarLinhas("cliente", "lote", 20, "anterior"),
  ).toEqual([
    { chave: "linha", tipo: "sistema", atributos: { nome: "Provisório", quantidade: 2 } },
  ]);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_linhas_levantamento", {
    p_cliente_id: "cliente",
    p_lote_id: "lote",
    p_limite: 20,
    p_apos: "anterior",
  });
  api.rpc.mockResolvedValueOnce({
    data: [{ chave: "linha", tipo: "sistema", atributos: { foto: "privado" } }],
    error: null,
  });
  await expect(
    supabaseLevantamentosAdapter.listarLinhas("cliente", "lote", 20, null),
  ).rejects.toThrow();
  await expect(
    supabaseLevantamentosAdapter.listarLinhas("cliente", "lote", 101, null),
  ).rejects.toThrow("Paginação inválida");
});

it("recebe só no staging, envia requestId e rejeita envelope divergente", async () => {
  const requestId = "17810000-0000-4000-8000-000000000001";
  const pedido = {
    requestId,
    origem: "campo" as const,
    chaveOrigem: "lote",
    linhas: [{ chave: "1", tipo: "sistema" as const, atributos: { nome: "Nome" } }],
  };
  api.rpc.mockResolvedValueOnce({
    data: {
      aggregateId: "17810000-0000-4000-8000-000000000002",
      revision: 1,
      state: "pendente",
      created: true,
      linkedIds: {},
      warnings: [],
      requestId,
    },
    error: null,
  });
  expect(await supabaseLevantamentosAdapter.receber("cliente", pedido)).toMatchObject({
    requestId,
    state: "pendente",
  });
  expect(api.rpc).toHaveBeenCalledWith("sso_receber_levantamento_manual", {
    p_request_id: requestId,
    p_cliente_id: "cliente",
    p_origem_declarada: "campo",
    p_chave_origem: "lote",
    p_linhas: pedido.linhas,
  });
  api.rpc.mockResolvedValueOnce({
    data: {
      aggregateId: "17810000-0000-4000-8000-000000000002",
      revision: 1,
      state: "pendente",
      created: true,
      linkedIds: {},
      warnings: [],
      requestId: "17810000-0000-4000-8000-000000000003",
    },
    error: null,
  });
  await expect(supabaseLevantamentosAdapter.receber("cliente", pedido)).rejects.toThrow();
});
