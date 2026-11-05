import { criarRelatorioPdf } from "../../../lib/pdf/relatorio-pdf";
import {
  type CronogramaFotografia,
  linhasCronogramaFotografia,
  textoCronogramaFotografia,
} from "../application/cronograma-fotografia";

export async function gerarPdfCronogramaFotografia(
  cronograma: CronogramaFotografia,
): Promise<Blob> {
  const documento = await criarRelatorioPdf({
    titulo: "Cronograma do Plano",
    subtitulo: "Fotografia parcial - não comprova execução",
  });
  documento.escreverTexto(textoCronogramaFotografia(cronograma));
  return new Blob([new Uint8Array(await documento.finalizar())], { type: "application/pdf" });
}
export async function gerarXlsxCronogramaFotografia(
  cronograma: CronogramaFotografia,
): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  return writeExcelFile(linhasCronogramaFotografia(cronograma), {
    sheet: "Cronograma parcial",
  }).toBlob();
}
