// Formatação de data para pt-BR sem deslocar o dia (DEF-31, DEF-44).
//
// Colunas `date` do Postgres (saldo_inicial_em, data_inspecao, …) chegam ao front como
// "YYYY-MM-DD", sem hora e sem fuso. `new Date("2026-11-25")` interpreta isso como
// meia-noite UTC; renderizado em America/Sao_Paulo (UTC-3) vira 24/11/2026 — um dia antes
// do que está gravado. Data sem hora é um dia de calendário: formata-se pelos próprios
// componentes da string, nunca pelo relógio do navegador.

const SOMENTE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formata uma data vinda do backend em dd/mm/aaaa.
 * - "YYYY-MM-DD" (coluna `date`): dia de calendário, sem conversão de fuso.
 * - timestamp com hora: convertido para o fuso local, como antes.
 * Entrada inválida é devolvida como veio, para não esconder o dado de quem olha a tela.
 */
export function formatarDataBr(valor: string | null | undefined): string {
  if (!valor) return "—";
  const somenteData = SOMENTE_DATA.exec(valor);
  if (somenteData) {
    const [, ano, mes, dia] = somenteData;
    return `${dia}/${mes}/${ano}`;
  }
  const parsed = new Date(valor);
  if (Number.isNaN(parsed.getTime())) return valor;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}
