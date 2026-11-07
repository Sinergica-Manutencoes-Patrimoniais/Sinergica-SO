import { criarRelatorioPdf } from "../../../lib/pdf/relatorio-pdf";
import { textoVersaoPlano, type DadosExportacaoVersao } from "../domain/exportacao-plano";

export async function gerarPdfVersaoPlano(dados: DadosExportacaoVersao): Promise<Blob> {
  const documento = await criarRelatorioPdf({ titulo: "Plano de Manutenção", subtitulo: "Versão aprovada - sem cronograma operacional" });
  documento.escreverTexto(textoVersaoPlano(dados));
  return new Blob([new Uint8Array(await documento.finalizar())], { type: "application/pdf" });
}
