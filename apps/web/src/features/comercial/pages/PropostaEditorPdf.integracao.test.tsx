// @vitest-environment jsdom

import { Blob as NodeBlob } from "node:buffer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropostaEditorPage } from "./PropostaEditorPage";

const estado = vi.hoisted(() => ({ verificar: vi.fn(async () => true) }));
vi.mock("../../../app/auth-context", () => ({
  useAuth: () => ({ user: { id: "usuario-a", papel: "superadmin" } }),
}));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ podeAcessar: () => true }),
}));
vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../infrastructure/supabase-proposta-adapter", () => ({
  supabasePropostaAdapter: {},
  confirmarAcessoVersaoPdf: estado.verificar,
  observarMudancaSessaoPdf: () => () => {},
}));
vi.mock("../application/proposta-queries", () => {
  const proposta = {
    id: "p1",
    tipo: "simples",
    status: "enviada",
    versaoAtual: 2,
    precoCentavos: 20000,
    validoAte: null,
  };
  const versoes = [
    {
      id: "v2",
      propostaId: "p1",
      versao: 2,
      criadoEm: "2026-01-02",
      criadoPor: null,
      payload: { proposta: { preco_centavos: 20000 }, itens: [{ descricao: "Item novo" }] },
    },
    {
      id: "v1",
      propostaId: "p1",
      versao: 1,
      criadoEm: "2026-01-01",
      criadoPor: null,
      payload: {
        proposta: { preco_centavos: 10000 },
        itens: [{ descricao: "Item antigo", custo_unitario_centavos: 987654 }],
      },
    },
  ];
  const vazio = () => ({ data: [] });
  const mutacao = () => ({ mutateAsync: vi.fn() });
  return {
    usePropostasDaOportunidade: () => ({ data: [proposta] }),
    usePropostaItens: vazio,
    usePropostaVersoes: () => ({ data: versoes }),
    useCriarProposta: mutacao,
    useSalvarComposicao: mutacao,
    useMudarStatusProposta: mutacao,
    useForcarPrecoAbaixoPiso: mutacao,
    useDuplicarProposta: mutacao,
    useVincularAssessment: mutacao,
  };
});
vi.mock("../application/precificacao-queries", () => ({
  useAliquotaVigente: () => ({}),
  useNiveisTecnico: () => ({ data: [] }),
  useParametrosPreco: () => ({}),
}));
vi.mock("../application/levantamento-queries", () => ({
  useLevantamentosDaConta: () => ({ data: [] }),
  useItensLevantamento: () => ({ data: [] }),
}));
vi.mock("../application/contrato-queries", () => ({
  useCriarContrato: () => ({ mutateAsync: vi.fn() }),
}));

async function textoPdf(blob: NodeBlob): Promise<string> {
  const pdf = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  const saida: string[] = [];
  for (const pagina of pdf.getPages()) {
    const conteudo = pagina.node.Contents();
    const streams =
      conteudo instanceof PDFArray
        ? Array.from({ length: conteudo.size() }, (_, i) => conteudo.lookup(i))
        : [conteudo];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) throw new Error("Stream inesperado");
      const operadores = new TextDecoder("latin1").decode(decodePDFRawStream(stream).decode());
      for (const match of operadores.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
        const pares = (match[1] ?? "").match(/../g) ?? [];
        saida.push(
          new TextDecoder("windows-1252").decode(
            Uint8Array.from(pares, (p) => Number.parseInt(p, 16)),
          ),
        );
      }
    }
  }
  return saida.join("\n");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("editor comercial: PDF histórico", () => {
  it("baixa versão selecionada com gerador real, sem custo ou dados da versão atual", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sem logo"));
    const baixar = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: baixar.mockReturnValue("blob:teste"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(
      <PropostaEditorPage
        oportunidadeId="o1"
        clienteId="c1"
        clienteNome="Conta A"
        onVoltar={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Simples · v2/i }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF da versão 1" }));
    await waitFor(() => expect(baixar).toHaveBeenCalledOnce());
    const blob = baixar.mock.calls[0]?.[0] as NodeBlob;
    const texto = await textoPdf(blob);
    expect(texto).toContain("Item antigo");
    expect(texto).toContain("100,00");
    expect(texto).not.toContain("Item novo");
    expect(texto).not.toContain("9.876,54");
  });
  it("não inicia download histórico quando servidor revoga acesso", async () => {
    estado.verificar.mockResolvedValueOnce(false);
    vi.stubGlobal("Blob", NodeBlob);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sem logo"));
    const baixar = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: baixar, revokeObjectURL: vi.fn() });
    render(
      <PropostaEditorPage
        oportunidadeId="o1"
        clienteId="c1"
        clienteNome="Conta A"
        onVoltar={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Simples · v2/i }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF da versão 1" }));
    await screen.findByText(/Acesso à versão indisponível/);
    expect(baixar).not.toHaveBeenCalled();
  });
});
