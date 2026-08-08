import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button — E00-S15 AC-2/AC-3", () => {
  it("dispara onClick", () => {
    const aoClicar = vi.fn();
    render(<Button onClick={aoClicar}>Salvar</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it("loading desabilita e não deixa clicar", () => {
    const aoClicar = vi.fn();
    render(
      <Button loading onClick={aoClicar}>
        Salvar
      </Button>,
    );
    const botao = screen.getByRole("button");
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("aria-busy", "true");
    fireEvent.click(botao);
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("disabled explícito também bloqueia clique", () => {
    const aoClicar = vi.fn();
    render(
      <Button disabled onClick={aoClicar}>
        Salvar
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it("aplica classe de variante e tamanho", () => {
    render(
      <Button variant="danger" size="sm">
        Excluir
      </Button>,
    );
    const botao = screen.getByRole("button", { name: "Excluir" });
    expect(botao.className).toContain("bg-danger");
    expect(botao.className).toContain("h-8");
  });
});
