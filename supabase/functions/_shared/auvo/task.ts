/**
 * O detalhe de task do Auvo varia entre versões: `questionnaires` pode vir
 * como lista, objeto aninhado ou JSON serializado. Aceita somente chaves de
 * identificador de questionário e limita a busca ao detalhe da própria task.
 */
export function taskTemQuestionario(
  valor: unknown,
  questionarioId: number,
  profundidade = 0,
): boolean {
  if (profundidade > 8 || valor == null) return false;
  if (typeof valor === "string") {
    try {
      return taskTemQuestionario(
        JSON.parse(valor),
        questionarioId,
        profundidade + 1,
      );
    } catch {
      return false;
    }
  }
  if (Array.isArray(valor)) {
    return valor.some((item) =>
      taskTemQuestionario(item, questionarioId, profundidade + 1)
    );
  }
  if (typeof valor !== "object") return false;

  return Object.entries(valor as Record<string, unknown>).some(
    ([chave, item]) => {
      const normalizada = chave.replace(/[^a-z]/gi, "").toLowerCase();
      if (normalizada === "questionnaireid") {
        return Number(item) === questionarioId;
      }
      return taskTemQuestionario(item, questionarioId, profundidade + 1);
    },
  );
}
