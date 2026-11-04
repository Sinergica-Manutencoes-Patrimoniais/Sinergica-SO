import { auvoGet, buildParamFilter } from "./client.ts";
import type { LeitorPaginaIdentidadeT24 } from "./busca-identidade-t24.ts";

type PaginaInterpretada = { itens: unknown[]; temProxima: boolean };
type ContratoBusca = {
  /** Deve falhar até que o filtro por externalId e a paginação estejam comprovados. */
  verificar: () => Promise<boolean>;
  interpretar: (resposta: unknown, pagina: number, limite: number) => PaginaInterpretada;
};

/** A prova de cobertura é externa; resposta vazia por si só não prova ausência. */
export function criarLeitorIdentidadeHttpT24(contrato: ContratoBusca): LeitorPaginaIdentidadeT24 {
  return async ({ osId, cursor, limite }) => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(osId) || !Number.isSafeInteger(limite) || limite < 1 || limite > 100 ||
      (cursor !== null && !/^[1-9]\d{0,2}$/.test(cursor))) throw new Error("Consulta inválida.");
    const pagina = cursor === null ? 1 : Number(cursor);
    if (pagina > 100 || await contrato.verificar() !== true) throw new Error("Cobertura da busca não comprovada.");
    const filtro = buildParamFilter({ externalId: osId });
    const resposta = await auvoGet<unknown>(`/tasks?${filtro}&page=${pagina}&pageSize=${limite}&order=asc`);
    const resultado = contrato.interpretar(resposta, pagina, limite);
    if (!resultado || !Array.isArray(resultado.itens) || resultado.itens.length > limite ||
      typeof resultado.temProxima !== "boolean" || (resultado.temProxima && pagina === 100))
      throw new Error("Página Auvo inválida ou incompleta.");
    // Revalidar a prova depois da chamada; mudança durante a leitura invalida a página.
    if (await contrato.verificar() !== true) throw new Error("Cobertura da busca alterada.");
    return { itens: resultado.itens, proximo: resultado.temProxima ? String(pagina + 1) : null, coberturaComprovada: true };
  };
}
