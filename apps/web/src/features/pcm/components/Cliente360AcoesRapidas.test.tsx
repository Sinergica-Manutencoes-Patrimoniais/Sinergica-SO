// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Cliente360AcoesRapidas } from "./Cliente360AcoesRapidas";

describe("Cliente360AcoesRapidas — E01-S163 AC-23", () => {
  it("não expõe ações para quem não tem escrita", () => {
    render(
      <Cliente360AcoesRapidas
        habilitado={false}
        onNovoChamado={vi.fn()}
        onNovaOs={vi.fn()}
        onNovaPreventiva={vi.fn()}
        onNovoComponente={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Ações rápidas do cliente")).not.toBeInTheDocument();
  });

  it("oferece os quatro atalhos e dispara o fluxo correto", () => {
    const onNovoChamado = vi.fn();
    const onNovaOs = vi.fn();
    const onNovaPreventiva = vi.fn();
    const onNovoComponente = vi.fn();
    render(
      <Cliente360AcoesRapidas
        habilitado
        onNovoChamado={onNovoChamado}
        onNovaOs={onNovaOs}
        onNovaPreventiva={onNovaPreventiva}
        onNovoComponente={onNovoComponente}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /novo chamado/i }));
    fireEvent.click(screen.getByRole("button", { name: /nova os/i }));
    fireEvent.click(screen.getByRole("button", { name: /nova preventiva/i }));
    fireEvent.click(screen.getByRole("button", { name: /novo componente/i }));

    expect(onNovoChamado).toHaveBeenCalledOnce();
    expect(onNovaOs).toHaveBeenCalledOnce();
    expect(onNovaPreventiva).toHaveBeenCalledOnce();
    expect(onNovoComponente).toHaveBeenCalledOnce();
  });
});
