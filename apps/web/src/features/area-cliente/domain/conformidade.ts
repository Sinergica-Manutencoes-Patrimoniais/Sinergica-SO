export type StatusConformidade = "vigente" | "vencendo" | "vencido";

export function statusConformidade(venceEm: string, hoje = new Date()): StatusConformidade {
  const ano = Number(venceEm.slice(0, 4));
  const mes = Number(venceEm.slice(5, 7));
  const dia = Number(venceEm.slice(8, 10));
  const vencimento = new Date(ano, mes - 1, dia);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.ceil((vencimento.getTime() - base.getTime()) / 86_400_000);
  if (dias < 0) return "vencido";
  if (dias <= 30) return "vencendo";
  return "vigente";
}
