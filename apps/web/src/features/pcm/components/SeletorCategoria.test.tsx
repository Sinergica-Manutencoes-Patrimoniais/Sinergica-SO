// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SeletorCategoria } from "./SeletorCategoria";

const criar = vi.fn().mockResolvedValue({ id: "cat-nova", descricao: "Bombas", sigla: "BOM" });

vi.mock("../application/ativos-cliente-queries", () => ({
  useCategoriasAtivo: () => ({
    data: [
      { id: "cat-ele", descricao: "Elétrica", sigla: "ELE" },
      { id: "cat-hid", descricao: "Hidráulica", sigla: "HID" },
    ],
  }),
  useCriarCategoriaAtivo: () => ({ mutateAsync: criar }),
}));

vi.mock("../infrastructure/supabase-catalogos-simples-adapter", () => ({
  supabaseCatalogosSimplesAdapter: {},
}));

describe("SeletorCategoria", () => {
  it("mostra legado, opções com sigla e seleciona a categoria criada", async () => {
    const onChange = vi.fn();
    render(
      <SeletorCategoria value={null} textoLegado="Tipo antigo" onChange={onChange} userId="u1" />,
    );

    expect(screen.getByText("Categoria atual (fora do catálogo): «Tipo antigo»")).toBeVisible();
    expect(screen.getByRole("option", { name: "Elétrica (ELE)" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "+ Nova categoria" }));
    await userEvent.type(screen.getByLabelText("Nome *"), "Bombas");
    await userEvent.tab();
    expect(screen.getByLabelText("Sigla *")).toHaveValue("BOM");
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect(criar).toHaveBeenCalledWith({ descricao: "Bombas", sigla: "BOM", userId: "u1" });
    expect(onChange).toHaveBeenCalledWith("cat-nova");
  });
});
