// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { MateriaisAquisicoesPage } from "./MateriaisAquisicoesPage";
vi.mock("../infrastructure/supabase-materiais-clientes-adapter", () => ({
  supabaseMateriaisClientesAdapter: {},
}));
vi.mock("../interfaces/listas-materiais/Central", () => ({
  CentralMateriais: ({
    cliente,
    onRascunhoAlterado,
  }: { cliente: string; onRascunhoAlterado?: (temRascunho: boolean) => void }) => {
    const [texto, setTexto] = useState("");
    return (
      <section>
        <p>Central do {cliente}</p>
        <label>
          Anotação local
          <input
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              onRascunhoAlterado?.(Boolean(e.target.value));
            }}
          />
        </label>
      </section>
    );
  },
}));
it("E01-S179 AC-7/AC-8: seleciona Cliente e remove contexto anterior ao trocar", async () => {
  const gateway = {
    listar: async () => [
      { id: "a", nome: "Escritório" },
      { id: "b", nome: "Outro" },
    ],
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MateriaisAquisicoesPage usuario="usuario" gateway={gateway} />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: "Escritório" });
  expect(screen.queryByText("Central do a")).toBeNull();
  fireEvent.change(screen.getByLabelText("Cliente dos materiais"), { target: { value: "a" } });
  await screen.findByText("Central do a");
  fireEvent.change(screen.getByLabelText("Anotação local"), { target: { value: "rascunho A" } });
  fireEvent.change(screen.getByLabelText("Cliente dos materiais"), { target: { value: "b" } });
  await screen.findByRole("dialog", { name: "Descartar rascunho de materiais?" });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.getByLabelText("Cliente dos materiais")).toHaveValue("a");
  expect(screen.getByLabelText("Anotação local")).toHaveValue("rascunho A");
  fireEvent.change(screen.getByLabelText("Cliente dos materiais"), { target: { value: "b" } });
  fireEvent.click(await screen.findByRole("button", { name: "Descartar e trocar cliente" }));
  expect(await screen.findByText("Central do b")).toBeTruthy();
  expect(screen.getByLabelText("Anotação local")).toHaveValue("");
  expect(screen.queryByText("Central do a")).toBeNull();
  fireEvent.change(screen.getByLabelText("Cliente dos materiais"), { target: { value: "a" } });
  expect(await screen.findByText("Central do a")).toBeTruthy();
  expect(screen.getByLabelText("Anotação local")).toHaveValue("");
});

it("DEF-25: mantém o texto do mesmo Cliente ao voltar à aba", async () => {
  const clientes = [
    { id: "a", nome: "Escritório" },
    { id: "b", nome: "Outro" },
  ];
  let concluir!: (dados: typeof clientes) => void;
  const listar = vi
    .fn()
    .mockResolvedValue(clientes)
    .mockImplementationOnce(async () => clientes)
    .mockImplementationOnce(
      () =>
        new Promise<typeof clientes>((resolve) => {
          concluir = resolve;
        }),
    );
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MateriaisAquisicoesPage usuario="usuario" gateway={{ listar }} />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: "Escritório" });
  fireEvent.change(screen.getByLabelText("Cliente dos materiais"), { target: { value: "a" } });
  fireEvent.change(await screen.findByLabelText("Anotação local"), {
    target: { value: "rascunho A" },
  });
  try {
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(listar).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByLabelText("Cliente dos materiais")).toBeDisabled());
    await act(async () => concluir(clientes));
    expect(await screen.findByLabelText("Anotação local")).toHaveValue("rascunho A");
    fireEvent.change(screen.getByLabelText("Cliente dos materiais"), { target: { value: "b" } });
    expect(
      await screen.findByRole("dialog", { name: "Descartar rascunho de materiais?" }),
    ).toBeTruthy();
  } finally {
    focusManager.setFocused(undefined);
  }
});
