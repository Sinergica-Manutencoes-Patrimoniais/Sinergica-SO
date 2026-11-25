// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { MateriaisAquisicoesPage } from "./MateriaisAquisicoesPage";
vi.mock("../interfaces/listas-materiais/Central", () => ({
  CentralMateriais: ({ cliente }: { cliente: string }) => {
    const [texto, setTexto] = useState("");
    return (
      <section>
        <p>Central do {cliente}</p>
        <label>
          Anotação local
          <input value={texto} onChange={(e) => setTexto(e.target.value)} />
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
  expect(await screen.findByText("Central do b")).toBeTruthy();
  expect(screen.getByLabelText("Anotação local")).toHaveValue("");
  expect(screen.queryByText("Central do a")).toBeNull();
});
