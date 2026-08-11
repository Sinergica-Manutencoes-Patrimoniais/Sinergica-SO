/** Domínio do contrato comercial (E03-S07). Sem I/O — espelha as guardas das RPCs (migration 0193):
 * `fn_ativar_contrato` e `fn_encerrar_contrato`. Se este arquivo e o banco divergirem, o banco
 * vence — a duplicação existe pra dar mensagem boa antes do round-trip. */

export type ContratoTipo = "residente" | "volante" | "avulso";
export type ContratoStatus = "rascunho" | "ativo" | "suspenso" | "encerrado";

export interface Contrato {
  id: string;
  propostaId: string;
  clienteId: string;
  tipo: ContratoTipo;
  valorMensalCentavos: number | null;
  diaVencimento: number;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  reajusteIndice: string | null;
  reajusteMes: number | null;
  escopo: unknown;
  status: ContratoStatus;
  encerradoEm: string | null;
  encerradoMotivo: string | null;
  financeiroContratoId: string | null;
  criadoEm: string;
}

/** AC-4: só rascunho pode ser ativado — mesma guarda de `fn_ativar_contrato`. Não existe hoje
 * nenhuma RPC que produza o status 'suspenso' (schema pronto pra story futura, ex. inadimplência
 * automática) — por isso não há `podeSuspender` nem transição pra lá neste domínio ainda. */
export function podeAtivar(status: ContratoStatus): boolean {
  return status === "rascunho";
}

/** AC-8: só contrato ativo ou suspenso pode ser encerrado. */
export function podeEncerrar(status: ContratoStatus): boolean {
  return status === "ativo" || status === "suspenso";
}

/** AC-4, edge case: vigência com fim no passado nunca ativa — mesma checagem de `fn_ativar_contrato`
 * (comparação por string ISO, evita o bug de fuso horário já corrigido na E04-S10/E03-S04). */
export function vigenciaVencida(vigenciaFim: string | null, hoje: Date = new Date()): boolean {
  if (!vigenciaFim) return false;
  const hojeIso = hoje.toISOString().slice(0, 10);
  return vigenciaFim < hojeIso;
}

/** AC-4, edge case: contrato não-avulso precisa de valor mensal positivo pra ativar; 'avulso' nunca
 * gera plano de faturamento recorrente, então nunca precisa de valor. */
export function valorInvalidoParaAtivar(
  tipo: ContratoTipo,
  valorMensalCentavos: number | null,
): boolean {
  if (tipo === "avulso") return false;
  return valorMensalCentavos === null || valorMensalCentavos <= 0;
}

/** Mensagem de bloqueio pra tentar ativar — `null` = pode ativar. A UI usa isto pra desabilitar o
 * botão com o motivo certo, sem esperar o erro do banco. */
export function motivoNaoPodeAtivar(
  contrato: Pick<Contrato, "status" | "tipo" | "valorMensalCentavos" | "vigenciaFim">,
): string | null {
  if (!podeAtivar(contrato.status)) {
    return `Só contrato em rascunho pode ser ativado (status atual: ${contrato.status}).`;
  }
  if (vigenciaVencida(contrato.vigenciaFim)) {
    return `Vigência encerrada em ${contrato.vigenciaFim} — edite a vigência antes de ativar.`;
  }
  if (valorInvalidoParaAtivar(contrato.tipo, contrato.valorMensalCentavos)) {
    return `Valor mensal precisa ser maior que zero pra ativar contrato do tipo ${contrato.tipo}.`;
  }
  return null;
}

/** AC-9: reajuste é SINALIZADO, nunca aplicado sozinho — esta função só diz se o mês chegou, quem
 * chama decide o que fazer com o sinal (badge na lista, nunca mudança automática de valor). */
export function reajusteDevido(reajusteMes: number | null, hoje: Date = new Date()): boolean {
  if (reajusteMes === null) return false;
  return hoje.getMonth() + 1 === reajusteMes;
}
