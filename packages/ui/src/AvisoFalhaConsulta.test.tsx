// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvisoFalhaConsulta } from "./AvisoFalhaConsulta";

describe("AvisoFalhaConsulta — Onda 2 do caderno", () => {
  it("oferece repetir quando quem chama passa a ação (falha possivelmente transitória)", async () => {
    const tentar = vi.fn();
    render(
      <AvisoFalhaConsulta onTentarNovamente={tentar}>
        Não foi possível consultar as linhas.
      </AvisoFalhaConsulta>,
    );
    const aviso = screen.getByRole("alert");
    expect(aviso).toHaveTextContent("Não foi possível consultar as linhas.");
    screen.getByRole("button", { name: "Tentar novamente" }).click();
    expect(tentar).toHaveBeenCalledTimes(1);
  });

  it("não oferece botão nenhum sem ação — negação permanente não se resolve repetindo", () => {
    render(<AvisoFalhaConsulta>Você não tem permissão para esta ação.</AvisoFalhaConsulta>);
    expect(screen.getByRole("alert")).toHaveTextContent("Você não tem permissão para esta ação.");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
