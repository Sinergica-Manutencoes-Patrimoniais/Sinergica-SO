/** Semana civil sem depender do fuso horário do navegador. */
export function semanaCapacidade(data: string): { inicio: string; fim: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data.startsWith("0000")) return null;
  const dia = new Date(`${data}T00:00:00.000Z`);
  if (!Number.isFinite(dia.getTime()) || dia.toISOString().slice(0, 10) !== data) return null;
  dia.setUTCDate(dia.getUTCDate() - ((dia.getUTCDay() + 6) % 7));
  const inicioCompleto = dia.toISOString();
  const inicio = inicioCompleto.slice(0, 10);
  dia.setUTCDate(dia.getUTCDate() + 6);
  const fimCompleto = dia.toISOString();
  const fim = fimCompleto.slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(inicio) ||
    inicio.startsWith("0000") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fim) ||
    fim.startsWith("0000")
  )
    return null;
  return { inicio, fim };
}
