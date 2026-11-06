import { formatarPropostaPublica } from "@sinergica/shared";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { criarRelatorioPdf } from "../../../lib/pdf/relatorio-pdf";
import { gerarPdfComAcessoAtual } from "../../comercial/pages/PropostaEditorPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));

// O gerador usa Helvetica/WinAnsi e escreve cada linha como string hexadecimal em Tj.
async function extrairTexto(bytes: Uint8Array): Promise<string> {
  const documento = await PDFDocument.load(bytes);
  const linhas: string[] = [];
  for (const pagina of documento.getPages()) {
    const conteudo = pagina.node.Contents();
    const streams =
      conteudo instanceof PDFArray
        ? Array.from({ length: conteudo.size() }, (_, i) => conteudo.lookup(i))
        : [conteudo];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) throw new Error("Stream de página inesperado");
      const operadores = new TextDecoder("latin1").decode(decodePDFRawStream(stream).decode());
      for (const match of operadores.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
        const pares = (match[1] ?? "").match(/../g) ?? [];
        linhas.push(
          new TextDecoder("windows-1252").decode(
            Uint8Array.from(pares, (p) => Number.parseInt(p, 16)),
          ),
        );
      }
    }
  }
  return linhas.join("\n");
}

describe("E01-S184: PDF público com gerador real", () => {
  it("apresenta venda da versão sem imprimir custos e preserva snapshot privado", async () => {
    const snapshot = {
      proposta: {
        tipo: "simples",
        escopo: "Manutencao",
        versao_atual: 2,
        preco_centavos: 150000,
        margem: "MARGEM-SEGREDO",
      },
      itens: [
        {
          descricao: "Peca",
          quantidade: 2,
          custo_unitario_centavos: 987654,
          total_centavos: 1975308,
          fornecedor: "FORNECEDOR-SEGREDO",
        },
      ],
    };
    const antes = structuredClone(snapshot);
    const fetchAnterior = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sem logo"));
    try {
      const pdf = await criarRelatorioPdf({
        titulo: "Proposta Comercial",
        subtitulo: "Conta A · v2",
      });
      pdf.escreverTexto(formatarPropostaPublica(snapshot, "Conta A"));
      const texto = await extrairTexto(await pdf.finalizar());
      expect(texto).toContain("Peca");
      expect(texto).toContain("1.500,00");
      expect(texto).not.toMatch(/MARGEM-SEGREDO|FORNECEDOR-SEGREDO|9\.876,54|19\.753,08/);
      expect(snapshot).toEqual(antes);
    } finally {
      fetchAnterior.mockRestore();
    }
  });

  it("usa os valores de cada versão fornecida, não os da composição atual", async () => {
    const versaoAntiga = {
      proposta: { versao_atual: 1, preco_centavos: 10000 },
      itens: [{ descricao: "Item antigo" }],
    };
    const versaoNova = {
      proposta: { versao_atual: 2, preco_centavos: 20000 },
      itens: [{ descricao: "Item novo" }],
    };
    const fetchAnterior = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sem logo"));
    try {
      const textos: string[] = [];
      for (const versao of [versaoAntiga, versaoNova]) {
        const pdf = await criarRelatorioPdf({ titulo: "Proposta Comercial" });
        pdf.escreverTexto(formatarPropostaPublica(versao, "Conta A"));
        textos.push(await extrairTexto(await pdf.finalizar()));
      }
      expect(textos[0]).toContain("Item antigo");
      expect(textos[0]).toContain("100,00");
      expect(textos[0]).not.toContain("Item novo");
      expect(textos[1]).toContain("Item novo");
      expect(textos[1]).toContain("200,00");
      expect(textos[1]).not.toContain("Item antigo");
    } finally {
      fetchAnterior.mockRestore();
    }
  });

  it("somente entrega PDF histórico real quando acesso atual é confirmado", async () => {
    const historico = {
      proposta: { versao_atual: 1, preco_centavos: 10000 },
      itens: [{ descricao: "Item antigo", custo_unitario_centavos: 987654 }],
    };
    const antes = structuredClone(historico);
    const fetchAnterior = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("sem logo"));
    const gerar = async () => {
      const pdf = await criarRelatorioPdf({ titulo: "Proposta Comercial" });
      pdf.escreverTexto(formatarPropostaPublica(historico, "Conta A"));
      return pdf.finalizar();
    };
    try {
      const entregas: Uint8Array[] = [];
      const entregar = (bytes: Uint8Array) => entregas.push(bytes);
      expect(
        await gerarPdfComAcessoAtual({
          gerar,
          permitido: () => true,
          verificarServidor: async () => false,
          entregar,
        }),
      ).toBe(false);
      expect(entregas).toHaveLength(0);
      expect(
        await gerarPdfComAcessoAtual({
          gerar,
          permitido: () => true,
          verificarServidor: async () => true,
          entregar,
        }),
      ).toBe(true);
      expect(entregas).toHaveLength(1);
      const bytes = entregas[0];
      if (!bytes) throw new Error("PDF não entregue");
      const texto = await extrairTexto(bytes);
      expect(texto).toContain("Item antigo");
      expect(texto).toContain("100,00");
      expect(texto).not.toContain("9.876,54");
      expect(historico).toEqual(antes);
    } finally {
      fetchAnterior.mockRestore();
    }
  });
});
