import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip, TooltipProvider } from "./Tooltip";

describe("Tooltip — E00-S15 AC-2", () => {
  it("sem content, não monta o Radix root (compatível com uso condicional legado)", () => {
    render(
      <TooltipProvider>
        <Tooltip content={null}>
          <button type="button">Ícone</button>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Ícone" })).toBeInTheDocument();
  });

  it("com content, renderiza o trigger normalmente (tooltip abre por hover/foco, fora do escopo deste teste)", () => {
    render(
      <TooltipProvider>
        <Tooltip content="Explicação">
          <button type="button">Ícone</button>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Ícone" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
