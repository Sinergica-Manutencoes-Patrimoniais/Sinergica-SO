/** E01-S204 — hooks das contagens oficiais (glossário: OS aberta, Backlog, Pré-chamado, Chamado
 * aberto, Demanda em aberto). Toda tela que mostra esses números lê daqui. */
import { useQuery } from "@tanstack/react-query";
import type { ContagemOperacional } from "../domain/contagem-operacional";

export interface FiltrosDemandaEmAberto {
  busca?: string;
  clienteId?: string;
  tecnicoFuncionarioId?: string;
  categoria?: string;
  dataInicio?: string | null;
  dataFim?: string | null;
}

export interface ContagemOperacionalGateway {
  contarDemandaEmAberto(
    filtros?: FiltrosDemandaEmAberto,
    signal?: AbortSignal,
  ): Promise<ContagemOperacional>;
  contarPorCliente(
    clienteId?: string,
    signal?: AbortSignal,
  ): Promise<Map<string, ContagemOperacional>>;
}

export const contagemOperacionalQueryKeys = {
  todas: () => ["contagem-operacional"] as const,
  demanda: (filtros: FiltrosDemandaEmAberto) =>
    ["contagem-operacional", "demanda", filtros] as const,
};

export function useDemandaEmAberto(
  gateway: ContagemOperacionalGateway,
  filtros: FiltrosDemandaEmAberto = {},
  habilitado = true,
) {
  return useQuery({
    queryKey: contagemOperacionalQueryKeys.demanda(filtros),
    queryFn: ({ signal }) => gateway.contarDemandaEmAberto(filtros, signal),
    enabled: habilitado,
    // Troca de filtro mantém o número anterior até o novo chegar; o cancelamento via signal
    // garante que resposta antiga não sobrescreve filtro novo.
    placeholderData: (anterior) => anterior,
  });
}
