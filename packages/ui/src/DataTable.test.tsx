import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";

interface Linha {
  id: string;
  nome: string;
  valor: number;
}

const colunas = [
  { chave: "nome", cabecalho: "Nome", render: (l: Linha) => l.nome, ordenavel: true },
  { chave: "valor", cabecalho: "Valor", render: (l: Linha) => l.valor, numerica: true },
];

describe("DataTable — E00-S15 AC-5", () => {
  it("renderiza linhas e colunas", () => {
    render(
      <DataTable
        colunas={colunas}
        itens={[{ id: "1", nome: "Cliente A", valor: 100 }]}
        chaveLinha={(l) => l.id}
        vazio="Nada aqui"
      />,
    );
    expect(screen.getByText("Cliente A")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("carregando renderiza linhas fantasma, não os itens (após 200ms — E00-S17 AC-2)", () => {
    vi.useFakeTimers();
    render(
      <DataTable
        colunas={colunas}
        itens={[{ id: "1", nome: "Cliente A", valor: 100 }]}
        chaveLinha={(l) => l.id}
        vazio="Nada aqui"
        carregando
        linhasCarregando={3}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Cliente A")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it("carregando por menos de 200ms não chega a mostrar linha fantasma (E00-S17 AC-2)", () => {
    vi.useFakeTimers();
    render(
      <DataTable
        colunas={colunas}
        itens={[{ id: "1", nome: "Cliente A", valor: 100 }]}
        chaveLinha={(l) => l.id}
        vazio="Nada aqui"
        carregando
        linhasCarregando={3}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(document.querySelectorAll(".skeleton").length).toBe(0);
    vi.useRealTimers();
  });

  it("sem itens e sem carregar mostra o estado vazio", () => {
    render(
      <DataTable colunas={colunas} itens={[]} chaveLinha={(l: Linha) => l.id} vazio="Nada aqui" />,
    );
    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
  });

  it("clique no cabeçalho ordenável chama onOrdenar com a chave da coluna", () => {
    const aoOrdenar = vi.fn();
    render(
      <DataTable
        colunas={colunas}
        itens={[{ id: "1", nome: "Cliente A", valor: 100 }]}
        chaveLinha={(l) => l.id}
        vazio="Nada aqui"
        onOrdenar={aoOrdenar}
        ordenacao={{ coluna: "nome", direcao: "asc" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Nome/ }));
    expect(aoOrdenar).toHaveBeenCalledWith("nome");
  });

  it("clique na linha chama onClickLinha com o item", () => {
    const aoClicar = vi.fn();
    const item = { id: "1", nome: "Cliente A", valor: 100 };
    render(
      <DataTable
        colunas={colunas}
        itens={[item]}
        chaveLinha={(l) => l.id}
        vazio="Nada aqui"
        onClickLinha={aoClicar}
      />,
    );
    fireEvent.click(screen.getByText("Cliente A").closest("tr") as HTMLElement);
    expect(aoClicar).toHaveBeenCalledWith(item);
  });

  it("Enter na linha focada também chama onClickLinha (E00-S15 AC-4/AC-2 — não só mouse)", () => {
    const aoClicar = vi.fn();
    const item = { id: "1", nome: "Cliente A", valor: 100 };
    render(
      <DataTable
        colunas={colunas}
        itens={[item]}
        chaveLinha={(l) => l.id}
        vazio="Nada aqui"
        onClickLinha={aoClicar}
      />,
    );
    const linha = screen.getByText("Cliente A").closest("tr") as HTMLElement;
    expect(linha).toHaveAttribute("tabIndex", "0");
    fireEvent.keyDown(linha, { key: "Enter" });
    expect(aoClicar).toHaveBeenCalledWith(item);
  });
});
