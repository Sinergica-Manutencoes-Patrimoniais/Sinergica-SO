export interface ParcelaRetorno {
  id: string;
  clienteId: string;
  chamadoId: string;
  resolvida: boolean;
  emOutroChamado: boolean;
}

export interface ParcelaComposicao {
  id: string;
  pendenciaId: string;
  clienteId: string;
  ativaEmBacklog: boolean;
}

/** Prévia somente: servidor deve validar novamente e garantir unicidade em transação. */
export function preverComposicaoBacklog(entrada: {
  clienteId: string;
  parcelas: readonly ParcelaComposicao[];
  selecionadas: readonly string[];
}): { parcelaId: string; pendenciaId: string }[] {
  if (!entrada.clienteId.trim() || entrada.selecionadas.length === 0)
    throw new Error("Seleção inválida.");
  const porId = new Map<string, ParcelaComposicao>();
  for (const parcela of entrada.parcelas) {
    const chave = parcela.id.toLowerCase();
    if (!parcela.id.trim() || porId.has(chave)) throw new Error("Parcelas inválidas.");
    porId.set(chave, parcela);
  }
  const vistas = new Set<string>();
  const pendenciasVistas = new Set<string>();
  return entrada.selecionadas.map((id) => {
    const chave = id.toLowerCase();
    const parcela = porId.get(chave);
    if (
      vistas.has(chave) ||
      !parcela ||
      parcela.clienteId !== entrada.clienteId ||
      !parcela.pendenciaId.trim() ||
      pendenciasVistas.has(parcela.pendenciaId.toLowerCase()) ||
      parcela.ativaEmBacklog !== false
    )
      throw new Error("Parcela indisponível ou fora do contexto.");
    vistas.add(chave);
    pendenciasVistas.add(parcela.pendenciaId.toLowerCase());
    return { parcelaId: parcela.id, pendenciaId: parcela.pendenciaId };
  });
}
/** Prévia informativa; servidor verifica suspensão, escopo, autorização e concorrência. */
export function preverRetornoEscopo(entrada: {
  clienteId: string;
  chamadoId: string;
  parcelas: readonly ParcelaRetorno[];
}): string[] {
  if (!entrada.clienteId.trim() || !entrada.chamadoId.trim()) throw new Error("Contexto inválido.");
  const ids = new Set<string>();
  const retorno: string[] = [];
  for (const parcela of entrada.parcelas) {
    if (
      !parcela.id.trim() ||
      ids.has(parcela.id.toLowerCase()) ||
      parcela.clienteId !== entrada.clienteId ||
      parcela.chamadoId !== entrada.chamadoId ||
      typeof parcela.resolvida !== "boolean" ||
      typeof parcela.emOutroChamado !== "boolean"
    )
      throw new Error("Parcela inválida ou fora do contexto.");
    ids.add(parcela.id.toLowerCase());
    if (!parcela.resolvida && !parcela.emOutroChamado) retorno.push(parcela.id);
  }
  return retorno;
}
