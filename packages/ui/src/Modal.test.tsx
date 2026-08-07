import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal — E00-S15 AC-6", () => {
  it("aberto: role dialog, aria-modal e título ligado por aria-labelledby", () => {
    render(
      <Modal open onOpenChange={() => {}} titulo="Excluir cliente">
        Conteúdo
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? "")).toHaveTextContent("Excluir cliente");
  });

  it("fechado: não renderiza", () => {
    render(
      <Modal open={false} onOpenChange={() => {}} titulo="Excluir cliente">
        Conteúdo
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape chama onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(
      <Modal open onOpenChange={aoMudar} titulo="Excluir cliente">
        Conteúdo
      </Modal>,
    );
    await user.keyboard("{Escape}");
    expect(aoMudar).toHaveBeenCalledWith(false);
  });

  it("botão fechar chama onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(
      <Modal open onOpenChange={aoMudar} titulo="Excluir cliente">
        Conteúdo
      </Modal>,
    );
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(aoMudar).toHaveBeenCalledWith(false);
  });

  it("foco inicial cai dentro do painel (focus trap do Radix)", () => {
    render(
      <Modal open onOpenChange={() => {}} titulo="Excluir cliente">
        <button type="button">Confirmar</button>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
