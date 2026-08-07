import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog — E00-S16 AC-3", () => {
  it("foco inicial cai no Cancelar, não no destrutivo", async () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        titulo='Excluir cliente "Condomínio X"'
        descricao="Esta ação não pode ser desfeita."
        onConfirmar={async () => {}}
      />,
    );
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("confirmar chama onConfirmar e fecha ao resolver", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        titulo="Excluir"
        descricao="Confirma?"
        onConfirmar={onConfirmar}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirmar).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("se onConfirmar rejeitar, mostra o erro e NÃO fecha", async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn().mockRejectedValue(new Error("Cliente tem OS aberta"));
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        titulo="Excluir"
        descricao="Confirma?"
        onConfirmar={onConfirmar}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Cliente tem OS aberta")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("nomeia o registro no título — não usa 'este item' genérico", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        titulo='Excluir cliente "Condomínio X"'
        descricao="Ação não pode ser desfeita."
        onConfirmar={async () => {}}
      />,
    );
    expect(screen.getByText('Excluir cliente "Condomínio X"')).toBeInTheDocument();
  });
});
