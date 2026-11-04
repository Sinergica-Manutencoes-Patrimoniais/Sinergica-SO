// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LevantamentosWorkspace } from "./Workspace";

afterEach(cleanup);

it("reconsulta linhas ao mudar revisão do lote e não apresenta dados anteriores", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const lote = {
    id: "lote",
    origem: "campo",
    chaveOrigem: "origem",
    revisao: 1,
    criadoEm: "2026-10-27T00:00:00Z",
  };
  let resolver!: (
    linhas: { chave: string; tipo: string; atributos: Record<string, unknown> }[],
  ) => void;
  const gateway = {
    listarLotes: vi
      .fn()
      .mockResolvedValueOnce([lote])
      .mockResolvedValueOnce([{ ...lote, revisao: 2 }]),
    listarLinhas: vi
      .fn()
      .mockResolvedValueOnce([{ chave: "linha", tipo: "sistema", atributos: { nome: "Anterior" } }])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolver = resolve;
          }),
      ),
  };
  render(
    <QueryClientProvider client={client}>
      <LevantamentosWorkspace userId="u" clienteId="c" gateway={gateway} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /origem.*revisão 1/i }));
  expect(await screen.findByText("Anterior")).toBeTruthy();
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["levantamentos", "u", "c", "lotes"] });
  });
  await waitFor(() => expect(gateway.listarLinhas).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("Anterior")).toBeNull();
  await act(async () =>
    resolver([{ chave: "linha", tipo: "sistema", atributos: { nome: "Atual" } }]),
  );
  expect(await screen.findByText("Atual")).toBeTruthy();
});

it("identifica recepção manual sem alegar origem declarada ou verificada", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const gateway = {
    listarLotes: vi.fn().mockResolvedValue([
      {
        id: "m",
        origem: "manual",
        chaveOrigem: "m1",
        revisao: 1,
        criadoEm: "2026-10-27T00:00:00Z",
      },
    ]),
    listarLinhas: vi.fn().mockResolvedValue([]),
  };
  render(
    <QueryClientProvider client={client}>
      <LevantamentosWorkspace userId="u" clienteId="c" gateway={gateway} />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("button", {
      name: /Recepção manual.*origem declarada não disponível.*não verificada/i,
    }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /aprovar|receber levantamento/i })).toBeNull();
});

it("mostra linhas provisórias, sem oferecer aprovação e oculta dados em revalidação", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = {
    listarLotes: vi.fn().mockResolvedValue([
      {
        id: "lote",
        origem: "campo",
        chaveOrigem: "origem",
        revisao: 1,
        criadoEm: "2026-10-27T00:00:00Z",
      },
    ]),
    listarLinhas: vi
      .fn()
      .mockResolvedValue([
        { chave: "linha", tipo: "sistema", atributos: { nome: "Sistema provisório" } },
      ]),
  };
  render(
    <QueryClientProvider client={client}>
      <LevantamentosWorkspace userId="u" clienteId="c" gateway={api} />
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Origem declarada: campo \(não verificada\).*origem/,
    }),
  );
  expect(await screen.findByText("Sistema provisório")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /aprovar/i })).toBeNull();
  let rejeitar!: (erro: Error) => void;
  api.listarLinhas.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejeitar = reject;
      }),
  );
  void client.invalidateQueries({ queryKey: ["levantamentos", "u", "c", "linhas", "lote"] });
  await waitFor(() => expect(screen.queryByText("Sistema provisório")).toBeNull());
  await act(async () => rejeitar(new Error("sem acesso")));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Sistema provisório")).toBeNull();
});

it("descarta contexto e resposta antiga ao trocar Cliente", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let resolver!: (
    items: { chave: string; tipo: string; atributos: Record<string, unknown> }[],
  ) => void;
  const gateway = {
    listarLotes: vi.fn().mockImplementation(async (cliente: string) => [
      {
        id: cliente,
        origem: "campo",
        chaveOrigem: cliente,
        revisao: 1,
        criadoEm: "2026-10-27T00:00:00Z",
      },
    ]),
    listarLinhas: vi.fn(
      (
        _cliente: string,
        _lote: string,
        _limite: number,
        _apos: string | null,
        _signal?: AbortSignal,
      ) =>
        new Promise<{ chave: string; tipo: string; atributos: Record<string, unknown> }[]>(
          (resolve) => {
            resolver = resolve;
          },
        ),
    ),
  };
  const wrapper = (clienteId: string) => (
    <QueryClientProvider client={client}>
      <LevantamentosWorkspace userId="u" clienteId={clienteId} gateway={gateway} />
    </QueryClientProvider>
  );
  const view = render(wrapper("cliente-a"));
  fireEvent.click(await screen.findByRole("button", { name: /cliente-a/ }));
  await waitFor(() => expect(gateway.listarLinhas).toHaveBeenCalledTimes(1));
  const signal = gateway.listarLinhas.mock.calls[0]?.[4] as AbortSignal;
  view.rerender(wrapper("cliente-b"));
  expect(screen.queryByRole("button", { name: /cliente-a/ })).toBeNull();
  await screen.findByRole("button", { name: /cliente-b/ });
  expect(signal.aborted).toBe(true);
  await act(async () =>
    resolver([{ chave: "a", tipo: "area", atributos: { nome: "Dados cliente A" } }]),
  );
  expect(screen.queryByText("Dados cliente A")).toBeNull();
});
