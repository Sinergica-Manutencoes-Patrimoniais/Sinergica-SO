import type { ReceberFaturavel } from "@sinergica/shared";

/** Prévia sem autorização ou gravação; servidor deve verificar origem e competência. */
export function prepararConferenciaFaturavel(
  valorOriginalCentavos: number,
  valorConferidoCentavos: number,
  motivo: string,
) {
  if (
    ![valorOriginalCentavos, valorConferidoCentavos].every(
      (valor) => Number.isSafeInteger(valor) && valor >= 0,
    )
  )
    throw new Error("Valor faturável inválido.");
  const motivoNormalizado = motivo.trim();
  if (
    motivoNormalizado.length > 2000 ||
    (valorOriginalCentavos !== valorConferidoCentavos && !motivoNormalizado)
  )
    throw new Error("Motivo de ajuste inválido.");
  return { valorOriginalCentavos, valorConferidoCentavos, motivo: motivoNormalizado || null };
}

/** Prévia conservadora; unicidade e origem oficial só podem ser asseguradas no servidor. */
export function compararOrigemFaturavel(anterior: ReceberFaturavel, recebido: ReceberFaturavel) {
  if (
    identidadeFaturavel(anterior.clienteId) !== identidadeFaturavel(recebido.clienteId) ||
    anterior.origemTipo !== recebido.origemTipo ||
    identidadeFaturavel(anterior.origemId) !== identidadeFaturavel(recebido.origemId)
  )
    return "outra_origem" as const;
  if (
    anterior.valorCentavos !== recebido.valorCentavos ||
    anterior.competencia !== recebido.competencia ||
    anterior.evidencias.length !== recebido.evidencias.length ||
    anterior.evidencias.some((id, i) => id !== recebido.evidencias[i])
  )
    return "conteudo_divergente" as const;
  return "reentrega_identica" as const;
}

export interface AlocacaoFaturavel {
  id: string;
  valorCentavos: number;
}
export interface EstornoFaturavel {
  id: string;
  alocacaoId: string;
  valorCentavos: number;
}

/** UUIDs são insensíveis a caixa; identificadores legados mantêm sua forma literal. */
function identidadeFaturavel(id: string): string {
  if (typeof id !== "string" || !id || id !== id.trim()) throw new Error("Identidade inválida.");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id.toLowerCase() : id;
}

/** Prévia local: não autoriza, registra nem efetiva operação financeira. */
export function calcularSaldoFaturavel(
  valorConferidoCentavos: number,
  alocacoes: readonly AlocacaoFaturavel[],
  estornos: readonly EstornoFaturavel[],
): number {
  const inteiro = (valor: number) => Number.isSafeInteger(valor) && valor >= 0;
  if (!inteiro(valorConferidoCentavos)) throw new Error("Valor conferido inválido.");
  const porId = new Map<string, bigint>();
  for (const alocacao of alocacoes) {
    const chave = identidadeFaturavel(alocacao.id);
    if (
      porId.has(chave) ||
      !inteiro(alocacao.valorCentavos) ||
      alocacao.valorCentavos === 0
    )
      throw new Error("Alocação inválida.");
    porId.set(chave, BigInt(alocacao.valorCentavos));
  }
  const idsEstornos = new Set<string>();
  for (const estorno of estornos) {
    const chave = identidadeFaturavel(estorno.id);
    const chaveAlocacao = identidadeFaturavel(estorno.alocacaoId);
    const saldoAlocacao = porId.get(chaveAlocacao);
    if (
      idsEstornos.has(chave) ||
      saldoAlocacao === undefined ||
      !inteiro(estorno.valorCentavos) ||
      estorno.valorCentavos === 0 ||
      BigInt(estorno.valorCentavos) > saldoAlocacao
    )
      throw new Error("Estorno inválido.");
    idsEstornos.add(chave);
    porId.set(chaveAlocacao, saldoAlocacao - BigInt(estorno.valorCentavos));
  }
  let saldo = BigInt(valorConferidoCentavos);
  for (const valor of porId.values()) saldo -= valor;
  if (saldo < 0n) throw new Error("Saldo insuficiente.");
  return Number(saldo);
}
