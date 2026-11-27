import type { Sheet } from "write-excel-file/universal";
import { type EstadoEstrutura, montarPlanilhaEstrutura } from "../domain/importacao-estrutura";

const LARGURA_MINIMA = 10;
const LARGURA_MAXIMA = 64;
const FOLGA = 3;

function larguraTexto(valor: string | number): number {
  return String(valor)
    .split(/\r\n|\r|\n/)
    .reduce((maior, linha) => Math.max(maior, linha.length), 0);
}

export async function gerarExportacaoEstruturaXlsx(estado: EstadoEstrutura): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  const abas: Sheet<Blob>[] = Object.entries(montarPlanilhaEstrutura(estado)).map(
    ([sheet, linhas]) => {
      const columns: { width: number }[] = [];
      for (const linha of linhas) {
        for (const [indice, valor] of linha.entries()) {
          const width = Math.max(
            columns[indice]?.width ?? LARGURA_MINIMA,
            larguraTexto(valor) + FOLGA,
          );
          columns[indice] = { width: Math.min(width, LARGURA_MAXIMA) };
        }
      }
      const data = linhas.map((linha) =>
        linha.map((valor) =>
          typeof valor === "string" &&
          (/[\r\n]/.test(valor) || larguraTexto(valor) + FOLGA > LARGURA_MAXIMA)
            ? { value: valor, wrap: true }
            : valor,
        ),
      );
      return { sheet, columns, data };
    },
  );
  return writeExcelFile(abas).toBlob();
}
