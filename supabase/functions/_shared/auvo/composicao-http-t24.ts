import { criarComposicaoT24 } from "./composicao-t24.ts";
import { criarTransporteHttpT24 } from "./transporte-http-t24.ts";

type DependenciasComposicao = Parameters<typeof criarComposicaoT24>[0];
type DependenciasTransporte = Parameters<typeof criarTransporteHttpT24>[0];

/**
 * Compõe a fronteira autenticada com o transporte de tentativa única.
 * Não registra rota, agendador ou segredos. A composição responsável deve
 * fornecer contrato e busca comprovados antes de habilitar qualquer executor.
 */
export function criarComposicaoHttpT24(
  dependencias: Omit<DependenciasComposicao, "criarTransporte"> & DependenciasTransporte,
): (req: Request) => Promise<Response> {
  const { contrato, buscarPagina, extrairCriacao, extrairLeitura, ...composicao } = dependencias;
  return criarComposicaoT24({
    ...composicao,
    criarTransporte: () => criarTransporteHttpT24({
      contrato,
      buscarPagina,
      extrairCriacao,
      extrairLeitura,
    }),
  });
}
