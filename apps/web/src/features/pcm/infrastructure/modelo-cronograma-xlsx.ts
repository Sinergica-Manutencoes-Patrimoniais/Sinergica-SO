import { COLUNAS_CRONOGRAMA } from "../domain/leitura-plano";

/** Modelo de matriz legada para conferência; datas e atividades são informadas pelo operador. */
export async function gerarModeloCronogramaXlsx(): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  return writeExcelFile([
    ["Modelo de cronograma: preencher a data de cada semana na linha 4."],
    ["Acrescente colunas S02, S03… somente conforme o calendário aplicável."],
    [...COLUNAS_CRONOGRAMA, "HS TÉCNICO / OCORR.", "S01"],
  ], { sheet: "CRONOGRAMA" }).toBlob();
}
