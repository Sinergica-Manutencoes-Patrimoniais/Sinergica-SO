// domain/agenda-tecnico.ts — E01-S104. Board semanal de agenda do técnico (cronograma de campo).
// 1ª fase: só visual/manual, sem alocação automática nem checagem de conflito (AC do spec).

export interface AlocacaoTecnico {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  clienteId: string;
  clienteNome: string;
  data: string; // ISO yyyy-mm-dd
  horaInicio: string | null; // HH:mm
  horaFim: string | null; // HH:mm — E01-S112
}

export interface AlocacaoFormData {
  funcionarioId: string;
  clienteId: string;
  data: string;
  horaInicio?: string | null;
  horaFim?: string | null;
}

/** AC-1: semana em colunas seg–sáb (6 dias, mesmo formato da referência visual da reunião).
 * `referencia` pode ser qualquer dia da semana — sempre normaliza pra segunda-feira daquela semana. */
export function diasDaSemana(referencia: Date): string[] {
  const dia = referencia.getDay(); // 0=dom..6=sáb
  const deslocamentoSegunda = dia === 0 ? -6 : 1 - dia;
  const segunda = new Date(referencia);
  segunda.setDate(referencia.getDate() + deslocamentoSegunda);
  segunda.setHours(0, 0, 0, 0);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(segunda);
    d.setDate(segunda.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function semanaAnterior(referencia: Date): Date {
  const d = new Date(referencia);
  d.setDate(d.getDate() - 7);
  return d;
}

export function semanaSeguinte(referencia: Date): Date {
  const d = new Date(referencia);
  d.setDate(d.getDate() + 7);
  return d;
}

/** AC-2/AC-5: agrupa alocações por dia (ISO), ordenadas por hora dentro do dia — sem checagem de
 * conflito (mesmo técnico pode ter 2+ alocações no mesmo dia, é permitido nesta fase). */
export function agruparPorDia(
  alocacoes: AlocacaoTecnico[],
  dias: string[],
): Map<string, AlocacaoTecnico[]> {
  const mapa = new Map<string, AlocacaoTecnico[]>(dias.map((dia) => [dia, []]));
  for (const alocacao of alocacoes) {
    const lista = mapa.get(alocacao.data);
    if (lista) lista.push(alocacao);
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => (a.horaInicio ?? "").localeCompare(b.horaInicio ?? ""));
  }
  return mapa;
}

/** AC-3: cor consistente por técnico entre os dias — hash simples do id, paleta fixa. */
const PALETA_CORES = ["#C5362B", "#1E8E45", "#2E6DB4", "#9A5A00", "#6B3FA0", "#0F8C8C", "#B23A6B"];

export function corDoTecnico(funcionarioId: string): string {
  let hash = 0;
  for (let i = 0; i < funcionarioId.length; i++) {
    hash = (hash * 31 + funcionarioId.charCodeAt(i)) % PALETA_CORES.length;
  }
  return PALETA_CORES[Math.abs(hash) % PALETA_CORES.length] ?? "#5A6175";
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}

/** AC-2: fim não pode vir antes do início; fim sem início também é inválido (não daria pra saber
 * a duração da alocação). */
export function validarAlocacao(input: AlocacaoFormData): AlocacaoFormData {
  if (!input.funcionarioId) throw new Error("Técnico é obrigatório.");
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  if (!input.data) throw new Error("Data é obrigatória.");
  const horaInicio = textoOuNull(input.horaInicio);
  const horaFim = textoOuNull(input.horaFim);
  if (horaFim && !horaInicio) {
    throw new Error("Informe o horário de início junto com o de fim.");
  }
  if (horaInicio && horaFim && horaFim < horaInicio) {
    throw new Error("O horário de fim não pode ser antes do início.");
  }
  return {
    funcionarioId: input.funcionarioId,
    clienteId: input.clienteId,
    data: input.data,
    horaInicio,
    horaFim,
  };
}
