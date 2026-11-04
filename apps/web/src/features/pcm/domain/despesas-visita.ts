/** Regras locais informativas; autorização e validação dos vínculos cabem ao servidor. */
export interface ValoresDespesaVisita {
  previstoCentavos: number;
  realizadoCentavos: number | null;
  status: "ativa" | "cancelada";
}

export interface ParcelaDespesaVisita {
  osId: string;
  visitaId: string;
  clienteId: string;
  valorCentavos: number;
}

const centavosValidos = (valor: number) => Number.isSafeInteger(valor) && valor >= 0;

/** Divide centavos igualmente, atribuindo os centavos restantes pela ordem dos IDs. */
export function dividirRateioIgual(totalCentavos: number, osIds: readonly string[]) {
  if (!centavosValidos(totalCentavos) || osIds.length === 0 || osIds.length > 100)
    throw new Error("Não é possível dividir o valor informado.");
  const ordenados = [...osIds].sort((a, b) => {
    const esquerda = a.toLowerCase();
    const direita = b.toLowerCase();
    return esquerda < direita ? -1 : esquerda > direita ? 1 : 0;
  });
  const identidades = ordenados.map((id) => id.toLowerCase());
  if (identidades.some((id) => !id.trim()) || new Set(identidades).size !== identidades.length)
    throw new Error("Seleção de OS inválida ou repetida.");
  const total = BigInt(totalCentavos);
  const quantidade = BigInt(ordenados.length);
  const base = total / quantidade;
  const restante = total % quantidade;
  return ordenados.map((osId, indice) => ({
    osId,
    valorCentavos: Number(base + (BigInt(indice) < restante ? 1n : 0n)),
  }));
}

/** Não soma previsão ao realizado nem transforma valor ausente em zero. */
export function valoresParaRelatorio(despesa: ValoresDespesaVisita) {
  if (
    (despesa.status !== "ativa" && despesa.status !== "cancelada") ||
    !centavosValidos(despesa.previstoCentavos) ||
    (despesa.realizadoCentavos !== null && !centavosValidos(despesa.realizadoCentavos))
  ) {
    throw new Error("Valor de despesa inválido.");
  }
  if (despesa.status === "cancelada") return null;
  return {
    previstoCentavos: despesa.previstoCentavos,
    realizadoCentavos: despesa.realizadoCentavos,
  };
}

/** Consolida apenas despesas distintas já autorizadas e carregadas pelo chamador. */
export function consolidarDespesasVisita(
  despesas: readonly (ValoresDespesaVisita & { id: string })[],
) {
  const ids = new Set<string>();
  let previstoCentavos = 0;
  let realizadoCentavos = 0;
  let semRealizacao = 0;
  for (const despesa of despesas) {
    if (!despesa.id.trim() || ids.has(despesa.id))
      throw new Error("Identidade de despesa inválida ou duplicada.");
    ids.add(despesa.id);
    const valores = valoresParaRelatorio(despesa);
    if (!valores) continue;
    previstoCentavos += valores.previstoCentavos;
    if (valores.realizadoCentavos === null) semRealizacao++;
    else realizadoCentavos += valores.realizadoCentavos;
    if (!Number.isSafeInteger(previstoCentavos) || !Number.isSafeInteger(realizadoCentavos))
      throw new Error("Total excede precisão segura.");
  }
  return { previstoCentavos, realizadoCentavos, semRealizacao };
}

/** Prévia local da base; previsão continua identificada e não é gasto realizado. */
export function custoParaApuracao(despesa: ValoresDespesaVisita) {
  const valores = valoresParaRelatorio(despesa);
  if (!valores) return null;
  return valores.realizadoCentavos === null
    ? { base: "previsto" as const, valorCentavos: valores.previstoCentavos }
    : { base: "realizado" as const, valorCentavos: valores.realizadoCentavos };
}

/** Prévia sem autoridade sobre a existência ou vigência das OS informadas. */
export function validarRateio(
  despesa: ValoresDespesaVisita & { visitaId: string; clienteId: string },
  parcelas: readonly ParcelaDespesaVisita[],
): boolean {
  let valores: ReturnType<typeof valoresParaRelatorio>;
  try {
    valores = valoresParaRelatorio(despesa);
  } catch {
    return false;
  }
  if (!valores || !despesa.visitaId.trim() || !despesa.clienteId.trim()) return false;
  if (parcelas.length === 0) return true;
  const ids = new Set<string>();
  let restante = valores.realizadoCentavos ?? valores.previstoCentavos;
  for (const parcela of parcelas) {
    if (
      !parcela.osId.trim() ||
      ids.has(parcela.osId) ||
      parcela.clienteId !== despesa.clienteId ||
      parcela.visitaId !== despesa.visitaId ||
      !centavosValidos(parcela.valorCentavos) ||
      parcela.valorCentavos > restante
    )
      return false;
    ids.add(parcela.osId);
    restante -= parcela.valorCentavos;
  }
  return restante === 0;
}
