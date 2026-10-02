/**
 * O detalhe de task do Auvo varia entre versões: `questionnaires` pode vir
 * como lista, objeto aninhado ou JSON serializado. Aceita somente chaves de
 * identificador de questionário e limita a busca ao detalhe da própria task.
 */
export function taskTemQuestionario(
  valor: unknown,
  questionarioId: number,
  questionarioNome?: string,
  profundidade = 0,
): boolean {
  if (profundidade > 8 || valor == null) return false;
  if (typeof valor === "string") {
    try {
      return taskTemQuestionario(
        JSON.parse(valor),
        questionarioId,
        questionarioNome,
        profundidade + 1,
      );
    } catch {
      return normalizar(valor) === normalizar(questionarioNome ?? "");
    }
  }
  if (Array.isArray(valor)) {
    return valor.some((item) =>
      taskTemQuestionario(
        item,
        questionarioId,
        questionarioNome,
        profundidade + 1,
      )
    );
  }
  if (typeof valor !== "object") return false;

  return Object.entries(valor as Record<string, unknown>).some(
    ([chave, item]) => {
      const normalizada = chave.replace(/[^a-z]/gi, "").toLowerCase();
      if (normalizada === "questionnaireid") {
        return Number(item) === questionarioId;
      }
      if (
        ["questionnairedescription", "questionnairename", "description", "name"]
          .includes(normalizada) && typeof item === "string"
      ) return normalizar(item) === normalizar(questionarioNome ?? "");
      return taskTemQuestionario(
        item,
        questionarioId,
        questionarioNome,
        profundidade + 1,
      );
    },
  );
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim()
    .toLowerCase();
}
