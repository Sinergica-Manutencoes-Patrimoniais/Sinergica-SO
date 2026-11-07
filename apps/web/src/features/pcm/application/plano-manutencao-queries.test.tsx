// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { usePlanosManutencao } from "./plano-manutencao-queries";

it("recarrega somente após salvar com sucesso e mantém escopo do Cliente", async () => {
  const gateway = {
    listarPlanos: vi.fn().mockResolvedValue([]),
    salvarPlano: vi.fn().mockRejectedValueOnce(new Error("negado")).mockResolvedValueOnce({}),
    adicionarRotina: vi.fn(),
    editarRotina: vi.fn(),
    listarVersoes: vi.fn(),
    listarRotinas: vi.fn(),
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const cliente = "16500000-0000-4000-8000-00000000000a";
  const { result } = renderHook(() => usePlanosManutencao(gateway, "usuario", cliente, true), {
    wrapper,
  });
  await waitFor(() => expect(result.current.planos.isSuccess).toBe(true));
  const comando = {
    requestId: "16500000-0000-4000-8000-000000000101",
    expectedRevision: 0,
    planoId: "16500000-0000-4000-8000-000000000011",
    clienteId: "16500000-0000-4000-8000-00000000000a",
    nome: "Plano",
  };
  await act(async () => {
    await expect(result.current.salvar.mutateAsync(comando)).rejects.toThrow();
  });
  expect(gateway.listarPlanos).toHaveBeenCalledTimes(1);
  await act(async () => {
    await result.current.salvar.mutateAsync(comando);
  });
  await waitFor(() => expect(gateway.listarPlanos).toHaveBeenCalledTimes(2));
  expect(gateway.listarPlanos).toHaveBeenLastCalledWith(cliente, 50, null, expect.any(AbortSignal));
});
