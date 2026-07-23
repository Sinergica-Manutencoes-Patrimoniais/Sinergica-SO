export interface PontoProjecaoCaixa {
  diasHorizonte: number;
  dataLimite: string;
  saldoProjetadoCentavos: number;
  entradasPrevistasCentavos: number;
  saidasPrevistasCentavos: number;
}

export function temAlertaSaldoNegativo(pontos: PontoProjecaoCaixa[]): boolean {
  return pontos.some((p) => p.saldoProjetadoCentavos < 0);
}

export function primeiroPontoNegativo(pontos: PontoProjecaoCaixa[]): PontoProjecaoCaixa | null {
  return pontos.find((p) => p.saldoProjetadoCentavos < 0) ?? null;
}
