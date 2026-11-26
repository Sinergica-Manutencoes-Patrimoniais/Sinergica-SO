// DEF-19: ao fechar um diálogo pelo teclado sem gravar, o foco não voltava ao botão que o
// abriu; o Tab seguinte recomeçava do início do documento. As páginas montam o diálogo só
// quando ele abre (`{modal && <XFormModal />}` com `open` fixo), então o Radix recebe a
// desmontagem direta do Root e a devolução de foco dele não acontece.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Modal } from "./Modal";

/** Reproduz o padrão real das páginas: o diálogo só existe enquanto aberto. */
function TelaComDialogoMontadoSobDemanda() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Novo cliente
      </button>
      {aberto && (
        <Modal
          open
          onOpenChange={(valor) => {
            if (!valor) setAberto(false);
          }}
          titulo="Novo cliente"
        >
          <button type="button">Gravar</button>
        </Modal>
      )}
    </>
  );
}

describe("Modal — devolução de foco (DEF-19)", () => {
  it("devolve o foco ao acionador quando fechado por Escape", async () => {
    const user = userEvent.setup();
    render(<TelaComDialogoMontadoSobDemanda />);
    const acionador = screen.getByRole("button", { name: "Novo cliente" });
    await user.click(acionador);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(acionador);
  });

  it("devolve o foco ao acionador quando fechado pelo botão Fechar", async () => {
    const user = userEvent.setup();
    render(<TelaComDialogoMontadoSobDemanda />);
    const acionador = screen.getByRole("button", { name: "Novo cliente" });
    await user.click(acionador);
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(document.activeElement).toBe(acionador);
  });
});
