import type { CelulaOoxml } from "./aba-ooxml.ts";
import { analisarEstruturaCsv, type DiagnosticoLinhaCsv } from "./importacao-estrutura-csv.ts";

const COLUNAS = 10;
const MAX_LINHAS = 1001; // cabeçalho e 1000 registros

/**
 * Converte células de aba já selecionada para a conferência local existente.
 * Não extrai ZIP, não autentica a fonte e não envia dados ao servidor.
 */
export function analisarEstruturaOoxml(celulas: readonly CelulaOoxml[]): DiagnosticoLinhaCsv[] {
  const linhas = new Map<number, string[]>();
  const coordenadas = new Set<string>();
  for (const celula of celulas) {
    if (!Number.isInteger(celula.linha) || celula.linha < 1 || !Number.isInteger(celula.coluna) || celula.coluna < 1) {
      throw new Error("Coordenada inválida.");
    }
    const coordenada = `${celula.linha}:${celula.coluna}`;
    if (coordenadas.has(coordenada)) throw new Error("Célula duplicada.");
    coordenadas.add(coordenada);
    if (celula.formula !== null || celula.formulaCompartilhada || celula.tipo === "erro") {
      throw new Error(`Fórmula ou erro não permitido em ${celula.referencia}.`);
    }
    if (celula.tipo === "vazio" && celula.valor === null) continue;
    if (celula.linha > MAX_LINHAS || celula.coluna > COLUNAS) {
      throw new Error(`Conteúdo fora do modelo em ${celula.referencia}.`);
    }
    if (celula.valor === null || !["texto", "numero"].includes(celula.tipo)) {
      throw new Error(`Tipo não suportado em ${celula.referencia}.`);
    }
    // A representação numérica pode ocultar zeros à esquerda em códigos e referências.
    if (celula.tipo === "numero" && (celula.linha === 1 || celula.coluna !== 5)) {
      throw new Error(`Informe ${celula.referencia} como texto para preservar a identificação.`);
    }
    const linha = linhas.get(celula.linha) ?? Array<string>(COLUNAS).fill("");
    linha[celula.coluna - 1] = celula.valor;
    linhas.set(celula.linha, linha);
  }
  const ultimaLinha = Math.max(1, ...linhas.keys());
  const csv = Array.from({ length: ultimaLinha }, (_, indice) => {
    const campos = linhas.get(indice + 1) ?? Array<string>(COLUNAS).fill("");
    return campos.map((campo) => `"${campo.replace(/"/g, '""')}"`).join(";");
  }).join("\r\n");
  return analisarEstruturaCsv(csv);
}
