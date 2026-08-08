import { renderHook } from "@testing-library/react";
import { act } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./Toast";
import { useAcaoComDesfazer } from "./use-acao-com-desfazer";

function envolver({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe("useAcaoComDesfazer — E00-S16 AC-4", () => {
  it("executa a ação imediatamente, sem diálogo", async () => {
    const acao = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAcaoComDesfazer(), { wrapper: envolver });
    await act(async () => {
      await result.current.executar({ acao, desfazer: vi.fn(), mensagem: "Arquivado" });
    });
    expect(acao).toHaveBeenCalledOnce();
  });

  it("propaga a rejeição da ação (chamador decide o tratamento de erro)", async () => {
    const acao = vi.fn().mockRejectedValue(new Error("falhou"));
    const { result } = renderHook(() => useAcaoComDesfazer(), { wrapper: envolver });
    await expect(
      act(async () => {
        await result.current.executar({ acao, desfazer: vi.fn(), mensagem: "Arquivado" });
      }),
    ).rejects.toThrow("falhou");
  });

  it("mostra toast com Desfazer que chama a função de desfazer", async () => {
    const desfazer = vi.fn().mockResolvedValue(undefined);
    function Consumidor() {
      const { executar } = useAcaoComDesfazer();
      return (
        <button
          type="button"
          onClick={() => executar({ acao: async () => {}, desfazer, mensagem: "Arquivado" })}
        >
          arquivar
        </button>
      );
    }
    const { render, screen } = await import("@testing-library/react");
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Consumidor />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "arquivar" }));
    await user.click(await screen.findByRole("button", { name: "Desfazer" }));
    expect(desfazer).toHaveBeenCalledOnce();
  });

  it("useToast fora do provider lançaria (garantia indireta de que o hook depende do provider)", () => {
    expect(() => renderHook(() => useToast())).toThrow(/ToastProvider/);
  });
});
