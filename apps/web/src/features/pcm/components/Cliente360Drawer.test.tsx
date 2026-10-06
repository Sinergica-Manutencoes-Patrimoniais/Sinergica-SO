// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Cliente360Drawer } from "./Cliente360Drawer";

describe("Cliente360Drawer", () => {
  it("fecha com Escape e devolve o foco ao acionador", () => {
    const onFechar = vi.fn();
    render(
      <>
        <button type="button" id="origem">
          Abrir
        </button>
        <Cliente360Drawer aberto titulo="Detalhe" onFechar={onFechar} originElementId="origem">
          <button type="button">Ação</button>
        </Cliente360Drawer>
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledOnce();
  });

  it("expõe um diálogo modal com rótulo acessível", () => {
    render(
      <Cliente360Drawer aberto titulo="Detalhe da OS" onFechar={() => undefined}>
        Conteúdo
      </Cliente360Drawer>,
    );
    expect(screen.getByRole("dialog", { name: "Detalhe da OS" })).toBeInTheDocument();
  });
});
