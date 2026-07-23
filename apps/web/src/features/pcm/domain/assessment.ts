// domain/assessment.ts — E01-S90. Inspeção como documento de assessment do cliente: motivo da
// visita, e cada item deriva Chamado/Backlog/OS com responsável. Reusa `pcm.inspecoes`/
// `pcm.inspecao_itens` (mesma mecânica de E01-S73), sem tabela nova (design.md D1).

export type MotivoAssessment = "inicio" | "alteracao_contrato" | "anual";
export type DestinoItemAssessment = "chamado" | "backlog" | "os";
export type ResponsavelDestino = "sinergica" | "terceiro" | "cliente";

export const MOTIVO_ASSESSMENT_LABEL: Record<MotivoAssessment, string> = {
  inicio: "Início de contrato",
  alteracao_contrato: "Alteração de contrato",
  anual: "Revisão anual",
};

export const DESTINO_ITEM_LABEL: Record<DestinoItemAssessment, string> = {
  chamado: "Chamado",
  backlog: "Backlog",
  os: "OS",
};

export const RESPONSAVEL_DESTINO_LABEL: Record<ResponsavelDestino, string> = {
  sinergica: "Sinérgica executa",
  terceiro: "Terceirizado",
  cliente: "Cliente resolve",
};

export interface NovoAssessmentInput {
  clientId: string;
  motivo: MotivoAssessment;
  dataInspecao: string;
}

/** AC-1: cliente e motivo são obrigatórios pra abrir um assessment. */
export function validarNovoAssessment(input: NovoAssessmentInput): NovoAssessmentInput {
  if (!input.clientId) throw new Error("Cliente é obrigatório.");
  if (!input.dataInspecao) throw new Error("Data é obrigatória.");
  return input;
}

/** AC-3/casos de borda: um item já derivado não deriva de novo sem intenção clara — bloqueia
 * qualquer segunda derivação (a UI simplesmente esconde as ações depois que `destino` é setado). */
export function validarDerivarItem(item: { destino: DestinoItemAssessment | null }): void {
  if (item.destino !== null) {
    throw new Error("Este item já foi derivado — não é possível derivar de novo.");
  }
}

export interface QuestaoAuvo {
  chave: string;
  pergunta: string;
  resposta: string;
  fotoUrls: string[];
}

/** D2/casos de borda: o formato do questionário Auvo varia — extrai campos por um conjunto de
 * chaves conhecidas (pergunta/question/title, resposta/answer/value, fotos/photos/images) e nunca
 * descarta uma resposta: quando nada reconhecível é encontrado, vira um item "a classificar" com o
 * JSON bruto na descrição, em vez de se perder. */
export function mapearQuestionarioParaQuestoes(checklistRaw: unknown): QuestaoAuvo[] {
  if (!Array.isArray(checklistRaw)) return [];
  return checklistRaw.map((bruta, indice) => mapearUmaQuestao(bruta, indice));
}

function mapearUmaQuestao(bruta: unknown, indice: number): QuestaoAuvo {
  const registro = isRecord(bruta) ? bruta : {};
  const pergunta = primeiroTexto(registro, ["pergunta", "question", "title", "titulo", "nome"]);
  const resposta = primeiroTexto(registro, ["resposta", "answer", "value", "valor", "texto"]);
  const chaveBruta = primeiroTexto(registro, ["id", "questionId", "chave", "key"]);
  const fotoUrls = extrairFotoUrls(registro);

  if (!pergunta && !resposta) {
    return {
      chave: chaveBruta ?? `item-${indice}`,
      pergunta: "Item a classificar",
      resposta: JSON.stringify(bruta),
      fotoUrls,
    };
  }

  return {
    chave: chaveBruta ?? pergunta ?? `item-${indice}`,
    pergunta: pergunta ?? "Item a classificar",
    resposta: resposta ?? "",
    fotoUrls,
  };
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function primeiroTexto(registro: Record<string, unknown>, chaves: string[]): string | null {
  for (const chave of chaves) {
    const valor = registro[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
    if (typeof valor === "number") return String(valor);
  }
  return null;
}

function extrairFotoUrls(registro: Record<string, unknown>): string[] {
  for (const chave of ["fotos", "photos", "images", "anexos", "midias"]) {
    const valor = registro[chave];
    if (Array.isArray(valor)) {
      return valor
        .map((item) => (typeof item === "string" ? item : isRecord(item) ? item.url : null))
        .filter((url): url is string => typeof url === "string" && url.length > 0);
    }
  }
  return [];
}
