export interface EventoAuditoria {
  campo: string;
  valorAnterior: string;
  valorNovo: string;
}

/** Diferenças entre um lançamento realizado antes/depois de uma correção — vira 1 linha de
 * auditoria append-only por campo alterado (AC-2). Só os 3 campos que fazem sentido corrigir num
 * lançamento já realizado. */
export function diferencasLancamento(
  antigo: { valorCentavos: number; categoriaId: string; dataCompetencia: string },
  novo: { valorCentavos: number; categoriaId: string; dataCompetencia: string },
): EventoAuditoria[] {
  const diffs: EventoAuditoria[] = [];
  if (antigo.valorCentavos !== novo.valorCentavos) {
    diffs.push({
      campo: "valor_centavos",
      valorAnterior: String(antigo.valorCentavos),
      valorNovo: String(novo.valorCentavos),
    });
  }
  if (antigo.categoriaId !== novo.categoriaId) {
    diffs.push({
      campo: "categoria_id",
      valorAnterior: antigo.categoriaId,
      valorNovo: novo.categoriaId,
    });
  }
  if (antigo.dataCompetencia !== novo.dataCompetencia) {
    diffs.push({
      campo: "data_competencia",
      valorAnterior: antigo.dataCompetencia,
      valorNovo: novo.dataCompetencia,
    });
  }
  return diffs;
}
