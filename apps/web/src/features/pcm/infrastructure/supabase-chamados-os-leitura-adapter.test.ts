import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabaseChamadosOsLeituraAdapter } from "./supabase-chamados-os-leitura-adapter";

const clienteId = "16700000-0000-4000-8000-00000000000a";
const chamadoId = "16700000-0000-4000-8000-000000000011";
const osId = "16700000-0000-4000-8000-000000000021";

beforeEach(() => {
  vi.resetAllMocks();
  api.schema.mockReturnValue({ rpc: api.rpc });
});

it("consulta página de OS no Cliente e Chamado solicitados", async () => {
  api.rpc.mockResolvedValue({
    data: [{ id: osId, numero: "OS-001", titulo: "Reparo", status: "aberta" }],
    error: null,
  });
  const resultado = await supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 10, null);
  expect(resultado).toEqual([{ id: osId, numero: "OS-001", titulo: "Reparo", status: "aberta" }]);
  expect(api.schema).toHaveBeenCalledWith("pcm");
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_ordens_chamado", {
    p_cliente_id: clienteId,
    p_chamado_id: chamadoId,
    p_limite: 10,
    p_apos: null,
  });
});

it("propaga erro de autorização sem apresentar lista vazia", async () => {
  api.rpc.mockResolvedValue({ data: null, error: new Error("sem acesso") });
  await expect(
    supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 10, osId),
  ).rejects.toThrow("sem acesso");
});

it("recusa resposta incompleta ou contendo campos inesperados", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: osId }], error: null });
  await expect(
    supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 10, null),
  ).rejects.toThrow();
  api.rpc.mockResolvedValueOnce({
    data: [{ id: osId, numero: "1", titulo: "Teste", status: "aberta", custo: 100 }],
    error: null,
  });
  await expect(
    supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 10, null),
  ).rejects.toThrow();
});

it("recusa limite inválido sem consultar servidor", async () => {
  await expect(
    supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 101, null),
  ).rejects.toThrow();
  expect(api.rpc).not.toHaveBeenCalled();
});

it("repassa cancelamento e cursor à consulta", async () => {
  const controller = new AbortController();
  const abortSignal = vi.fn().mockResolvedValue({ data: [], error: null });
  api.rpc.mockReturnValue({ abortSignal });
  expect(
    await supabaseChamadosOsLeituraAdapter.listar(
      clienteId,
      chamadoId,
      20,
      osId,
      controller.signal,
    ),
  ).toEqual([]);
  expect(abortSignal).toHaveBeenCalledWith(controller.signal);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_ordens_chamado", {
    p_cliente_id: clienteId,
    p_chamado_id: chamadoId,
    p_limite: 20,
    p_apos: osId,
  });
});

it("recusa páginas duplicadas, fora de ordem ou anteriores ao cursor", async () => {
  const ordem = (id: string) => ({ id, numero: "1", titulo: "Teste", status: "aberta" });
  const anterior = "16700000-0000-4000-8000-000000000020";
  const posterior = "16700000-0000-4000-8000-000000000022";
  for (const data of [
    [ordem(osId), ordem(osId)],
    [ordem(posterior), ordem(osId)],
    [ordem(anterior)],
  ]) {
    api.rpc.mockResolvedValueOnce({ data, error: null });
    await expect(
      supabaseChamadosOsLeituraAdapter.listar(clienteId, chamadoId, 10, osId),
    ).rejects.toThrow();
  }
});
