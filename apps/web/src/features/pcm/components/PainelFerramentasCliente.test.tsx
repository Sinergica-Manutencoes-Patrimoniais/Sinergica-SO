// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useAlocarFerramenta: vi.fn(),
  useDevolverFerramenta: vi.fn(),
  useFerramentasAlocadas: vi.fn(),
  useFerramentasDisponiveis: vi.fn(),
}));

vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../application/ativos-cliente-queries", () => hooks);
vi.mock("../infrastructure/supabase-ferramenta-alocacao-cliente-adapter", () => ({
  supabaseFerramentaAlocacaoClienteAdapter: {},
}));

import { PainelFerramentasCliente } from "./PainelFerramentasCliente";

describe("PainelFerramentasCliente — E01-S163 AC-19", () => {
  it("filtra por categoria, situação e período; mantém contagem e limpeza", async () => {
    hooks.useFerramentasAlocadas.mockReturnValue({
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      data: [
        {
          id: "alocacao-ativa",
          ferramentaId: "furadeira",
          ferramentaNome: "Furadeira",
          categoriaId: "eletrica",
          categoriaNome: "Elétrica",
          clienteId: "cliente-1",
          clienteNome: "Cliente 1",
          alocadaEm: "2026-10-10T10:00:00Z",
          devolvidaEm: null,
        },
        {
          id: "alocacao-devolvida",
          ferramentaId: "escada",
          ferramentaNome: "Escada",
          categoriaId: "acesso",
          categoriaNome: "Acesso",
          clienteId: "cliente-1",
          clienteNome: "Cliente 1",
          alocadaEm: "2026-08-10T10:00:00Z",
          devolvidaEm: "2026-08-12T10:00:00Z",
        },
      ],
    });
    hooks.useDevolverFerramenta.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });

    render(<PainelFerramentasCliente clienteId="cliente-1" temEscrita={false} />);

    expect(screen.getByText("2 visíveis de 2")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Filtrar ferramentas por situação"),
      "historico",
    );
    expect(screen.queryByText("Furadeira")).not.toBeInTheDocument();
    expect(screen.getByText("Escada")).toBeInTheDocument();
    expect(screen.getByText("1 visíveis de 2")).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText("Filtrar ferramentas por categoria"),
      "eletrica",
    );
    expect(screen.getByText("Nenhuma ferramenta para estes filtros.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText("Furadeira")).toBeInTheDocument();
    expect(screen.getByText("Escada")).toBeInTheDocument();
  });
});
