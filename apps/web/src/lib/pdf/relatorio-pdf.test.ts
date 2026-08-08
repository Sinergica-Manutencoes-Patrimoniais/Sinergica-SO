import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { criarRelatorioPdf } from "./relatorio-pdf";

// PNG 1x1 transparente — só precisa ser um PNG válido para `embedPng` aceitar.
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function bytesDoPng(): ArrayBuffer {
  const binario = atob(PNG_1X1_BASE64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("criarRelatorioPdf", () => {
  it("gera PDF válido com cabeçalho, rodapé e uma página para texto curto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytesDoPng() }),
    );

    const builder = await criarRelatorioPdf({
      titulo: "Relatório de Teste",
      subtitulo: "2026-08-07",
    });
    builder.escreverTexto("Linha única de conteúdo.");
    const bytes = await builder.finalizar();

    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("quebra em várias páginas quando o conteúdo não cabe em uma", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytesDoPng() }),
    );

    const builder = await criarRelatorioPdf({ titulo: "Relatório Longo" });
    const linhaLonga = "Linha de conteúdo repetida para forçar quebra de página automática.";
    builder.escreverTexto(Array.from({ length: 80 }, () => linhaLonga).join("\n"));
    const bytes = await builder.finalizar();

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("degrada sem logo quando o fetch do asset falha, sem lançar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const builder = await criarRelatorioPdf({ titulo: "Sem Logo" });
    builder.escreverTexto("Conteúdo mesmo sem logo.");
    const bytes = await builder.finalizar();

    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });
});
