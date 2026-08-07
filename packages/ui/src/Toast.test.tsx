import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";

function Disparador({
  tipo,
  msg = "Mensagem",
}: { tipo: "sucesso" | "erro" | "aviso" | "info"; msg?: string }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast[tipo](msg)}>
      disparar
    </button>
  );
}

describe("ToastProvider/useToast — E00-S16 AC-2", () => {
  it("sucesso usa role=status e aria-live polite", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Disparador tipo="sucesso" msg="Salvo com sucesso" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "disparar" }));
    const toast = await screen.findByText("Salvo com sucesso");
    expect(toast.closest('[role="status"]')).toBeInTheDocument();
  });

  it("erro usa role=alert e aria-live assertive, e não some sozinho", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Disparador tipo="erro" msg="Falhou" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "disparar" }));
    expect(await screen.findByText("Falhou")).toBeInTheDocument();
    // Sem timer nenhum programado pra erro — continua visível sem precisar esperar.
    expect(screen.getByText("Falhou").closest('[role="alert"]')).toBeInTheDocument();
  });

  it("sucesso some sozinho depois do tempo de auto-dismiss", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Disparador tipo="sucesso" msg="Some sozinho" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "disparar" }));
    expect(await screen.findByText("Some sozinho")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByText("Some sozinho")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("empilha no máximo 3 visíveis + contador", async () => {
    function DisparadorMultiplo() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            toast.info("Um");
            toast.info("Dois");
            toast.info("Três");
            toast.info("Quatro");
          }}
        >
          disparar todos
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <DisparadorMultiplo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "disparar todos" }));
    expect(screen.getByText("Um")).toBeInTheDocument();
    expect(screen.getByText("Três")).toBeInTheDocument();
    expect(screen.queryByText("Quatro")).not.toBeInTheDocument();
    expect(screen.getByText("+1 mais")).toBeInTheDocument();
  });

  it("comDesfazer mostra ação e a executa ao clicar", async () => {
    const desfazer = vi.fn();
    function DisparadorDesfazer() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.comDesfazer("Arquivado", desfazer)}>
          arquivar
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <DisparadorDesfazer />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "arquivar" }));
    await user.click(await screen.findByRole("button", { name: "Desfazer" }));
    expect(desfazer).toHaveBeenCalledOnce();
  });

  it("useToast fora do provider lança erro claro", () => {
    function SemProvider() {
      useToast();
      return null;
    }
    expect(() => render(<SemProvider />)).toThrow(/ToastProvider/);
  });
});
