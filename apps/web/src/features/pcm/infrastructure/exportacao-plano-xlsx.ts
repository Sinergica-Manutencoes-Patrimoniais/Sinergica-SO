import { type DadosExportacaoVersao, linhasVersaoPlano } from "../domain/exportacao-plano";

export async function xlsxVersaoPlano(dados: DadosExportacaoVersao): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  return writeExcelFile(linhasVersaoPlano(dados), { sheet: "Versão do Plano" }).toBlob();
}
