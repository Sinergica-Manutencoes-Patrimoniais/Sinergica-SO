import { buscarIdentidadeT24, type LeitorPaginaIdentidadeT24 } from "../auvo/busca-identidade-t24.ts";
import type { BuscaTarefaPorIdentidade } from "../auvo/reconciliar-task.ts";

type Resultado = { busca: BuscaTarefaPorIdentidade; correspondenciasVerificadas: string[] };
const inconclusiva = (): Resultado => ({
  busca: { completa: false, identidadeComprovada: false, candidatos: [] },
  correspondenciasVerificadas: [],
});

/**
 * Reaproveita a busca paginada por identidade da OS. O extrator pertence ao
 * contrato do fornecedor e deve retornar somente um identificador já validado.
 * Sem cobertura completa ou com identificador ausente/duplicado, não afirma
 * ausência nem libera qualquer ação.
 */
export async function buscarRecuperacaoT24(
  entrada: { osId: string; campoExternalId: string; contratoComprovado: boolean; limitePaginas: number; limitePagina: number },
  ler: LeitorPaginaIdentidadeT24,
  extrairId: (item: unknown) => string | null,
): Promise<Resultado> {
  const resultado = await buscarIdentidadeT24(entrada, ler);
  if (!resultado.completa || !resultado.identidadeComprovada || resultado.itens.length > 1000) return inconclusiva();
  try {
    const ids = resultado.itens.map(extrairId);
    if (ids.some((id) => typeof id !== "string" || !id || id.length > 200 || id.trim() !== id) ||
      new Set(ids).size !== ids.length) return inconclusiva();
    const candidatos = ids as string[];
    return {
      busca: { completa: true, identidadeComprovada: true, candidatos },
      correspondenciasVerificadas: [...candidatos],
    };
  } catch {
    return inconclusiva();
  }
}
