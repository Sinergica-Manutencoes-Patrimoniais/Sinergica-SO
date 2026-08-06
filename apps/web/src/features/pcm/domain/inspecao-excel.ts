// E01-S105 — parser determinístico do levantamento Excel antes da classificação por IA.
import type { ItemInspecaoImportado } from "../application/qualidade-gateway";

export interface PlanilhaInspecaoParseada {
  textoParaClassificacao: string;
  itensBrutos: ItemInspecaoImportado[];
}

export interface RevisaoImportacaoExcel {
  itens: ItemInspecaoImportado[];
  aviso: string | null;
}

interface LinhaLevantamento {
  local: string;
  fotos: string;
  relato: string;
}

function normalizarCabecalho(valor: unknown): string {
  return String(valor)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function coluna(header: string[], nomes: string[]): number {
  return header.findIndex((valor) => nomes.some((nome) => valor.includes(nome)));
}

function fotosDoTexto(valor: string): string[] {
  return valor
    .split(/[;\n,]/)
    .map((foto) => foto.trim())
    .filter((foto) => /^https?:\/\//i.test(foto));
}

function itemBruto(linha: LinhaLevantamento): ItemInspecaoImportado {
  const relato = linha.relato || "Ocorrência sem relato";
  return {
    local: linha.local,
    relatoOriginal: relato,
    sistema: "geral",
    tituloBacklog: `Inconformidade: ${relato.slice(0, 100)}`,
    descricaoTecnica: relato,
    citacaoNormativa: null,
    prioridade: "media",
    categoria: "corretiva",
    gravidade: 3,
    urgencia: 3,
    tendencia: 3,
    esforcoHoras: 0,
    justificativaEsforco: null,
    fotoUrls: fotosDoTexto(linha.fotos),
  };
}

/** Lê a primeira aba convertida pelo SheetJS. O relato é obrigatório; local e fotos permanecem
 * opcionais pois planilhas antigas da Auvo variam nesses nomes. */
export function parsearPlanilhaLevantamento(rows: unknown[][]): PlanilhaInspecaoParseada {
  if (rows.length < 2) throw new Error("Planilha vazia ou sem linhas de levantamento.");
  const headerRow = rows[0];
  if (!headerRow) throw new Error("Planilha sem cabeçalho.");
  const header = headerRow.map(normalizarCabecalho);
  const relatoIndex = coluna(header, ["relato", "descricao", "ocorrencia", "inconformidade"]);
  if (relatoIndex < 0) {
    throw new Error("Planilha sem coluna de relato/descrição da ocorrência.");
  }
  const localIndex = coluna(header, ["local", "ambiente", "setor"]);
  const fotosIndex = coluna(header, ["foto", "imagem", "anexo"]);
  const linhas = rows
    .slice(1)
    .map((row) => ({
      local: localIndex < 0 ? "" : String(row[localIndex] ?? "").trim(),
      fotos: fotosIndex < 0 ? "" : String(row[fotosIndex] ?? "").trim(),
      relato: String(row[relatoIndex] ?? "").trim(),
    }))
    .filter((linha) => linha.local || linha.relato);
  if (linhas.length === 0)
    throw new Error("Planilha não possui linhas de levantamento preenchidas.");
  return {
    textoParaClassificacao: linhas
      .map((linha) => `Local: ${linha.local}\nFotos: ${linha.fotos}\nRelato: ${linha.relato}`)
      .join("\n\n---\n\n"),
    itensBrutos: linhas.map(itemBruto),
  };
}

/** A IA é copiloto: resposta vazia ou indisponível nunca apaga o levantamento já lido. */
export function prepararRevisaoImportacaoExcel(
  classificados: ItemInspecaoImportado[],
  itensBrutos: ItemInspecaoImportado[],
): RevisaoImportacaoExcel {
  if (classificados.length > 0) return { itens: classificados, aviso: null };
  if (itensBrutos.length > 0) {
    return {
      itens: itensBrutos,
      aviso:
        "A IA não respondeu; o levantamento bruto foi preservado com GUT inicial 3/3/3 para sua revisão.",
    };
  }
  throw new Error("Nenhum item encontrado no relatório.");
}
