/** Período de calendário do Marketing (E06-S01, AC-7).
 *
 * Datas são strings `AAAA-MM-DD`, sem hora e sem fuso. A comparação é de string, que para esse
 * formato é a mesma ordem da data — e evita a classe inteira de bugs em que "hoje" muda de dia
 * porque alguém converteu para `Date` e voltou num fuso diferente.
 *
 * `domain/` puro: sem I/O, sem framework. */

export interface Periodo {
  readonly de: string;
  readonly ate: string;
}

/** Janela máxima aceita pela RPC `marketing.fn_metricas_periodo` — repetida aqui para o usuário
 * ver a recusa antes de uma ida ao servidor, não para substituí-la. */
export const MAXIMO_DE_DIAS = 366;

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

function comoDia(data: Date): string {
  // `toISOString` passaria por UTC e poderia voltar um dia. Monta à mão, no calendário local.
  const ano = data.getFullYear();
  const mes = `${data.getMonth() + 1}`.padStart(2, "0");
  const dia = `${data.getDate()}`.padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function partes(dia: string): [number, number, number] {
  const [ano, mes, data] = dia.split("-");
  return [Number(ano), Number(mes), Number(data)];
}

function somarDias(dia: string, dias: number): string {
  const [ano, mes, data] = partes(dia);
  return comoDia(new Date(ano, mes - 1, data + dias));
}

/** Diferença em dias, inclusiva nos dois extremos (um único dia conta como 1). */
export function diasDoPeriodo(periodo: Periodo): number {
  const [a1, m1, d1] = partes(periodo.de);
  const [a2, m2, d2] = partes(periodo.ate);
  const inicio = Date.UTC(a1, m1 - 1, d1);
  const fim = Date.UTC(a2, m2 - 1, d2);
  return Math.round((fim - inicio) / 86_400_000) + 1;
}

/** Os últimos `dias` dias **incluindo hoje** — é o que as pessoas querem dizer com "últimos 7". */
export function ultimosDias(dias: number, hoje = new Date()): Periodo {
  const ate = comoDia(hoje);
  return { de: somarDias(ate, -(dias - 1)), ate };
}

export function mesAtual(hoje = new Date()): Periodo {
  const ate = comoDia(hoje);
  return { de: `${ate.slice(0, 7)}-01`, ate };
}

/** Mesmo tamanho, imediatamente antes — base da comparação "vs. período anterior". */
export function periodoAnterior(periodo: Periodo): Periodo {
  const tamanho = diasDoPeriodo(periodo);
  return { de: somarDias(periodo.de, -tamanho), ate: somarDias(periodo.ate, -tamanho) };
}

/** Mensagem pronta para a tela, ou `null` quando o período serve. Recusar aqui evita mandar uma
 * consulta pesada ao banco só para receber `22023` de volta. */
export function problemaDoPeriodo(periodo: Periodo, maximoDeDias = MAXIMO_DE_DIAS): string | null {
  if (!FORMATO.test(periodo.de) || !FORMATO.test(periodo.ate)) return "Escolha as duas datas.";
  if (periodo.ate < periodo.de) return "A data final vem depois da inicial.";
  if (diasDoPeriodo(periodo) > maximoDeDias) return `O período vai até ${maximoDeDias} dias.`;
  return null;
}
