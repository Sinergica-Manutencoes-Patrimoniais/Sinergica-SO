// application/ativos-cliente-queries.ts — E01-S155: dado de servidor do cadastro de ativos
// (posição, categoria, identificador) via TanStack Query, nunca useEffect+carregar() manual
// (regra do CLAUDE.md). Cada hook recebe o gateway por parâmetro (mesmo padrão de
// operacao-queries.ts/resumo-inicio-queries.ts) — quem chama injeta o adapter singleton.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { criarCatalogoSimples, listarCatalogoSimples } from "./catalogos-simples";
import type { CatalogosSimplesGateway } from "./catalogos-simples-gateway";
import type { HierarquiaGateway } from "./hierarquia-gateway";

export const ativosClienteQueryKeys = {
  areas: (clienteId: string) => ["pcm", "ativos-cliente", clienteId, "areas"] as const,
  locais: (clienteId: string) => ["pcm", "ativos-cliente", clienteId, "locais"] as const,
  categorias: () => ["pcm", "ativos", "categorias"] as const,
};

export function useAreasDoCliente(gateway: HierarquiaGateway, clienteId: string | null) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.areas(clienteId ?? ""),
    queryFn: () => gateway.listarAreas(clienteId ?? ""),
    enabled: Boolean(clienteId),
  });
}

export function useCategoriasAtivo(gateway: CatalogosSimplesGateway) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.categorias(),
    queryFn: () => listarCatalogoSimples(gateway, "equipamento_categorias"),
  });
}

export function useCriarCategoriaAtivo(gateway: CatalogosSimplesGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      descricao,
      sigla,
      userId,
    }: { descricao: string; sigla: string; userId: string }) =>
      criarCatalogoSimples(gateway, { tipo: "equipamento_categorias", descricao, sigla, userId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ativosClienteQueryKeys.categorias() }),
  });
}

export function useLocaisDoCliente(gateway: HierarquiaGateway, clienteId: string | null) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.locais(clienteId ?? ""),
    queryFn: () => gateway.listarLocaisDoCliente(clienteId ?? ""),
    enabled: Boolean(clienteId),
  });
}
