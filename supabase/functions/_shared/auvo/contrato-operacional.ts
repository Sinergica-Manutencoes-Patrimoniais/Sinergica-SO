/** Identificadores e datas já normalizados pelo adaptador do contrato Auvo comprovado. */
export type CamposCriticosOperacionais = {
  tarefaId: string;
  tecnicoId: string;
  inicio: string;
  alvoId: string;
  questionarioId: string | null;
};

export type ResultadoLeituraOperacional =
  | { situacao: "bloqueada"; motivo: "contrato_nao_comprovado" | "campos_invalidos" | "questionario_obrigatorio" }
  | { situacao: "divergente"; campos: (keyof CamposCriticosOperacionais)[] }
  | { situacao: "campos_compativeis" };

const idValido = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 200 && id === id.trim();
const instanteValido = (valor: unknown): valor is string => {
  if (typeof valor !== "string") return false;
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(valor);
  if (!partes || partes[1] === "0000" || Number(partes[4]) > 23 || Number(partes[5]) > 59 || Number(partes[6]) > 59) return false;
  const data = new Date(0); data.setUTCFullYear(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return data.getUTCFullYear() === Number(partes[1]) && data.getUTCMonth() === Number(partes[2]) - 1 &&
    data.getUTCDate() === Number(partes[3]) && Number.isFinite(Date.parse(valor));
};
function valido(c: CamposCriticosOperacionais): boolean {
  return !!c && idValido(c.tarefaId) && idValido(c.tecnicoId) && idValido(c.alvoId) &&
    instanteValido(c.inicio) && (c.questionarioId === null || idValido(c.questionarioId));
}

/**
 * Apenas compara projeções normalizadas; não prova que o fornecedor persiste esses
 * campos nem valida sessão, versão, confirmação, task duplicada ou autorização.
 */
export function conferirLeituraOperacional(entrada: {
  contratoComprovado: boolean;
  questionarioObrigatorio: boolean;
  esperado: CamposCriticosOperacionais;
  observado: CamposCriticosOperacionais;
}): ResultadoLeituraOperacional {
  if (entrada.contratoComprovado !== true) return { situacao: "bloqueada", motivo: "contrato_nao_comprovado" };
  if (typeof entrada.questionarioObrigatorio !== "boolean" || !valido(entrada.esperado) || !valido(entrada.observado))
    return { situacao: "bloqueada", motivo: "campos_invalidos" };
  if (entrada.questionarioObrigatorio && entrada.esperado.questionarioId === null)
    return { situacao: "bloqueada", motivo: "questionario_obrigatorio" };
  const campos: (keyof CamposCriticosOperacionais)[] = [];
  for (const campo of ["tarefaId", "tecnicoId", "alvoId", "questionarioId"] as const)
    if (entrada.esperado[campo] !== entrada.observado[campo]) campos.push(campo);
  if (Date.parse(entrada.esperado.inicio) !== Date.parse(entrada.observado.inicio)) campos.push("inicio");
  return campos.length ? { situacao: "divergente", campos } : { situacao: "campos_compativeis" };
}
