import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge — E00-S15 AC-4", () => {
  it("resolve tone pro par de tokens certo, nunca hex", () => {
    render(<Badge tone="danger">Crítico</Badge>);
    const badge = screen.getByText("Crítico");
    expect(badge.className).toContain("bg-danger-soft");
    expect(badge.className).toContain("text-danger");
    expect(badge.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("default é neutral", () => {
    render(<Badge>Padrão</Badge>);
    expect(screen.getByText("Padrão").className).toContain("bg-line-soft");
  });
});
