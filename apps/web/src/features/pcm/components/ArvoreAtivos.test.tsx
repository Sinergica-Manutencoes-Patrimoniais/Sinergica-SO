// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArvoreAtivos } from "./ArvoreAtivos";

const mocks = vi.hoisted(() => ({ useArvoreAtivos: vi.fn() }));

vi.mock("../application/ativos-cliente-queries", () => ({
  useArvoreAtivos: mocks.useArvoreAtivos,
}));
vi.mock("../infrastructure/supabase-equipamentos-adapter", () => ({
  supabaseEquipamentosAdapter: {},
}));
vi.mock("../infrastructure/supabase-hierarquia-adapter", () => ({
  supabaseHierarquiaAdapter: {},
}));
vi.mock("../infrastructure/supabase-sistemas-adapter", () => ({ supabaseSistemasAdapter: {} }));
vi.mock("./DrawerDetalheAtivo", () => ({ DrawerDetalheAtivo: () => <div>Detalhe</div> }));

describe("ArvoreAtivos", () => {
  beforeEach(() => {
    mocks.useArvoreAtivos.mockReturnValue({
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      data: {
        id: "cliente",
        tipo: "cliente",
        nome: "Cliente",
        identificador: null,
        sigla: null,
        posicaoDivergente: null,
        total: 1,
        filhos: [
          {
            id: "area",
            tipo: "area",
            nome: "Torre A",
            identificador: null,
            sigla: "TOA",
            posicaoDivergente: null,
            total: 1,
            filhos: [
              {
                id: "item",
                tipo: "componente",
                nome: "Bomba principal",
                identificador: "CLI-TOA-BOM-01",
                sigla: null,
                posicaoDivergente: null,
                total: 0,
                filhos: [],
              },
            ],
          },
        ],
      },
    });
  });

  it("expande áreas, filtra e recolhe os nós", () => {
    render(<ArvoreAtivos clienteId="cliente" clienteNome="Cliente" />);
    expect(screen.getByText("Torre A")).toBeInTheDocument();
    expect(screen.getByText("Bomba principal")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Buscar na árvore"), {
      target: { value: "bomba" },
    });
    expect(screen.getByText("Bomba principal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recolher tudo" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar na árvore"), { target: { value: "" } });
    expect(screen.queryByText("Bomba principal")).not.toBeInTheDocument();
  });
});
