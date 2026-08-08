import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./Card";

describe("EmptyState — E00-S17 AC-6", () => {
  it("vazio (padrão) e filtrado usam data-variante distintos", () => {
    const { container: c1 } = render(<EmptyState titulo="Nada aqui">criar algo</EmptyState>);
    expect(c1.firstChild).toHaveAttribute("data-variante", "vazio");

    const { container: c2 } = render(
      <EmptyState titulo="Nenhum resultado" variante="filtrado">
        limpar filtro
      </EmptyState>,
    );
    expect(c2.firstChild).toHaveAttribute("data-variante", "filtrado");
  });

  it("renderiza título, texto de apoio e ação", () => {
    render(
      <EmptyState
        titulo="Nenhum resultado para estes filtros"
        acao={<button type="button">Limpar filtro</button>}
      >
        Ajuste os filtros aplicados
      </EmptyState>,
    );
    expect(screen.getByText("Nenhum resultado para estes filtros")).toBeInTheDocument();
    expect(screen.getByText("Ajuste os filtros aplicados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar filtro" })).toBeInTheDocument();
  });
});
