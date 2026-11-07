// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const sessao = vi.hoisted(() => ({ usuario: "u1" }));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: sessao.usuario } }, error: null }) } },
}));
import { useOrdensDoChamado } from "./chamados-os-queries";

beforeEach(() => { sessao.usuario = "u1"; });
afterEach(cleanup);

it("pagina por cursor e mantém cada Chamado no escopo do usuário e Cliente", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const primeira = Array.from({ length: 20 }, (_, i) => ({
    id: `os-${i}`,
    numero: `${i}`,
    titulo: "Teste",
    status: "aberta",
  }));
  const listar = vi
    .fn()
    .mockResolvedValueOnce(primeira)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ usuario, cliente, chamado }) => useOrdensDoChamado({ listar }, usuario, cliente, chamado),
    { wrapper, initialProps: { usuario: "u1", cliente: "c1", chamado: "ch1" } },
  );
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(listar).toHaveBeenCalledWith("c1", "ch1", 20, null, expect.any(AbortSignal));
  await act(async () => {
    await hook.result.current.fetchNextPage();
  });
  expect(listar).toHaveBeenLastCalledWith("c1", "ch1", 20, "os-19", expect.any(AbortSignal));
  sessao.usuario = "u2";
  hook.rerender({ usuario: "u2", cliente: "c2", chamado: "ch2" });
  await waitFor(() => expect(listar).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(hook.result.current.data?.pages).toEqual([[]]));
  expect(listar).toHaveBeenLastCalledWith("c2", "ch2", 20, null, expect.any(AbortSignal));
});

it("cancela consulta anterior e não mistura resposta tardia após troca de Cliente", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let resolver!: (valor: { id: string; numero: string; titulo: string; status: string }[]) => void;
  const listar = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    )
    .mockResolvedValueOnce([{ id: "novo", numero: "2", titulo: "Novo", status: "aberta" }]);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(({ cliente }) => useOrdensDoChamado({ listar }, "u1", cliente, "ch1"), {
    wrapper,
    initialProps: { cliente: "c1" },
  });
  await waitFor(() => expect(listar).toHaveBeenCalledTimes(1));
  const signal = listar.mock.calls[0]?.[4] as AbortSignal;
  hook.rerender({ cliente: "c2" });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(signal.aborted).toBe(true);
  await act(async () =>
    resolver([{ id: "velho", numero: "1", titulo: "Velho", status: "aberta" }]),
  );
  expect(hook.result.current.data?.pages[0]?.[0]?.id).toBe("novo");
});

it("não consulta com identidade incompleta e expõe erro da leitura", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const listar = vi.fn().mockRejectedValue(new Error("sem acesso"));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(({ usuario }) => useOrdensDoChamado({ listar }, usuario, "c1", "ch1"), {
    wrapper,
    initialProps: { usuario: "" },
  });
  expect(hook.result.current.fetchStatus).toBe("idle");
  expect(listar).not.toHaveBeenCalled();
  hook.rerender({ usuario: "u1" });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.data).toBeUndefined();
});

it("não expõe ordens anteriores quando nova consulta falha após revogação", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const listar = vi
    .fn()
    .mockResolvedValueOnce([{ id: "os-1", numero: "1", titulo: "Ordem", status: "aberta" }])
    .mockRejectedValueOnce(new Error("sem acesso"));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useOrdensDoChamado({ listar }, "u1", "c1", "ch1"), { wrapper });
  await waitFor(() => expect(hook.result.current.data?.pages[0]?.[0]?.id).toBe("os-1"));
  let consulta: Awaited<ReturnType<typeof hook.result.current.refetch>> | undefined;
  await act(async () => {
    consulta = await hook.result.current.refetch();
  });
  expect(consulta?.isError).toBe(true);
  await waitFor(() => expect(hook.result.current.data).toBeUndefined());
});
