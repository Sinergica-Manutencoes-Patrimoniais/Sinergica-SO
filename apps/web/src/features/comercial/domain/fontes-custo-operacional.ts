/**
 * Composição por fontes declaradas. A identidade é fornecida pelo fluxo dono da
 * despesa e não deve ser inferida de descrição, valor, fornecedor ou data.
 */
export type FonteCustoOperacional = {
  origem: "aquisicao" | "despesa_visita" | "outro";
  origemId: string;
  /** Identifica parcela canônica, quando a origem for rateada entre OS. */
  parcelaId: string | null;
  grupo: "aquisicao" | "operacional";
  valorCentavos: number;
};

export type ResultadoFontesCusto =
  | { valido: true; aquisicaoCentavos: number; operacionalCentavos: number }
  | { valido: false; motivo: "fonte_invalida" | "fonte_duplicada" | "valor_excedido" };

const LIMITE_CENTAVOS = 1_000_000_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUIDs representam a mesma identidade independentemente de caixa; outros códigos não. */
function identidadeCanonica(valor: string): string {
  return UUID.test(valor) ? valor.toLowerCase() : valor;
}

export function consolidarFontesCusto(fontes: readonly FonteCustoOperacional[]): ResultadoFontesCusto {
  const identidades = new Set<string>();
  const fontesInteiras = new Set<string>();
  const fontesParceladas = new Set<string>();
  let aquisicao = 0;
  let operacional = 0;
  for (const fonte of fontes) {
    if (!fonte || !["aquisicao", "despesa_visita", "outro"].includes(fonte.origem) ||
        !["aquisicao", "operacional"].includes(fonte.grupo) ||
        typeof fonte.origemId !== "string" || !fonte.origemId || fonte.origemId !== fonte.origemId.trim() ||
        (fonte.parcelaId !== null && (typeof fonte.parcelaId !== "string" || !fonte.parcelaId || fonte.parcelaId !== fonte.parcelaId.trim())) ||
        !Number.isSafeInteger(fonte.valorCentavos) || fonte.valorCentavos < 0 || fonte.valorCentavos > LIMITE_CENTAVOS) {
      return { valido: false, motivo: "fonte_invalida" };
    }
    // Grupo não faz parte da chave: mesma parcela não pode entrar duas vezes,
    // inclusive uma vez como aquisição e outra como custo operacional.
    const origemId = identidadeCanonica(fonte.origemId);
    const parcelaId = fonte.parcelaId === null ? null : identidadeCanonica(fonte.parcelaId);
    const chave = JSON.stringify([fonte.origem, origemId, parcelaId]);
    const origem = JSON.stringify([fonte.origem, origemId]);
    if (identidades.has(chave) || (fonte.parcelaId === null && fontesParceladas.has(origem)) ||
        (fonte.parcelaId !== null && fontesInteiras.has(origem))) return { valido: false, motivo: "fonte_duplicada" };
    identidades.add(chave);
    if (fonte.parcelaId === null) fontesInteiras.add(origem); else fontesParceladas.add(origem);
    if (fonte.grupo === "aquisicao") aquisicao += fonte.valorCentavos;
    else operacional += fonte.valorCentavos;
    if (!Number.isSafeInteger(aquisicao) || !Number.isSafeInteger(operacional) || aquisicao > LIMITE_CENTAVOS || operacional > LIMITE_CENTAVOS)
      return { valido: false, motivo: "valor_excedido" };
  }
  return { valido: true, aquisicaoCentavos: aquisicao, operacionalCentavos: operacional };
}
