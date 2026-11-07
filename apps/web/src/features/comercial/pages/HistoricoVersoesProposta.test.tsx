// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoricoVersoesProposta, gerarPdfComAcessoAtual } from "./PropostaEditorPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));

describe("histórico de versões da proposta", () => {
  it("permite baixar a versão selecionada sem substituí-la pela mais recente", () => {
    const antiga = {
      id: "v1",
      propostaId: "p",
      versao: 1,
      criadoEm: "2025-01-01T00:00:00Z",
      criadoPor: null,
      payload: { proposta: { preco_centavos: 10000 } },
    };
    const atual = {
      ...antiga,
      id: "v2",
      versao: 2,
      payload: { proposta: { preco_centavos: 20000 } },
    };
    const baixar = vi.fn();
    render(
      <HistoricoVersoesProposta versoes={[atual, antiga]} gerandoPdf={false} onBaixar={baixar} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF da versão 1" }));
    expect(baixar).toHaveBeenCalledOnce();
    expect(baixar).toHaveBeenCalledWith(antiga);
  });

  it("impede um segundo download durante geração", () => {
    const baixar = vi.fn();
    const versao = {
      id: "v1",
      propostaId: "p",
      versao: 1,
      criadoEm: "2025-01-01T00:00:00Z",
      criadoPor: null,
      payload: {},
    };
    render(<HistoricoVersoesProposta versoes={[versao]} gerandoPdf onBaixar={baixar} />);
    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF da versão 1" }));
    expect(baixar).not.toHaveBeenCalled();
  });
});

describe("entrega de PDF após mudança de acesso", () => {
  it("não entrega quando sessão muda durante geração", async () => {
    const entregar = vi.fn();
    let liberar!: (bytes: Uint8Array) => void;
    let ativo = true;
    const geracao = new Promise<Uint8Array>((resolve) => {
      liberar = resolve;
    });
    const operacao = gerarPdfComAcessoAtual({
      gerar: () => geracao,
      permitido: () => ativo,
      verificarServidor: async () => true,
      entregar,
    });
    ativo = false;
    liberar(new Uint8Array([1]));
    await operacao;
    expect(entregar).not.toHaveBeenCalled();
  });

  it("não entrega quando servidor nega acesso depois da geração", async () => {
    const entregar = vi.fn();
    await gerarPdfComAcessoAtual({
      gerar: async () => new Uint8Array([1]),
      permitido: () => true,
      verificarServidor: async () => false,
      entregar,
    });
    expect(entregar).not.toHaveBeenCalled();
  });

  it("não entrega quando sessão muda durante revalidação no servidor", async () => {
    const entregar = vi.fn();
    let liberar!: (resultado: boolean) => void;
    let ativo = true;
    const verificacao = new Promise<boolean>((resolve) => {
      liberar = resolve;
    });
    const operacao = gerarPdfComAcessoAtual({
      gerar: async () => new Uint8Array([1]),
      permitido: () => ativo,
      verificarServidor: () => verificacao,
      entregar,
    });
    await Promise.resolve();
    ativo = false;
    liberar(true);
    await operacao;
    expect(entregar).not.toHaveBeenCalled();
  });

  it("entrega quando sessão e acesso continuam válidos", async () => {
    const entregar = vi.fn();
    expect(
      await gerarPdfComAcessoAtual({
        gerar: async () => new Uint8Array([1]),
        permitido: () => true,
        verificarServidor: async () => true,
        entregar,
      }),
    ).toBe(true);
    expect(entregar).toHaveBeenCalledWith(new Uint8Array([1]));
  });
});
