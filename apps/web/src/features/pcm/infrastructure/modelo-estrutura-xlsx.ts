import { COLUNAS_ESTRUTURA } from "../application/importacao-estrutura-csv";

/** Modelo vazio, sem dados de exemplo que possam ser importados por engano. */
export async function gerarModeloEstruturaXlsx(): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  // Até 1.000 registros: identificação, códigos e referências são texto.
  // Quantidade fica sem formato de texto para aceitar número quando necessário.
  const linhasVazias = Array.from({ length: 1000 }, () =>
    COLUNAS_ESTRUTURA.map((_, indice) => indice === 4 ? null : { type: String, format: "@" }),
  );
  const cabecalho = COLUNAS_ESTRUTURA.map((coluna) => ({ type: String, value: coluna }));
  return writeExcelFile([cabecalho, ...linhasVazias], { sheet: "Estrutura" }).toBlob();
}
