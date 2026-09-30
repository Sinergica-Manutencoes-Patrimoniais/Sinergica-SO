// application/ativos-cliente-queries.ts — E01-S155: dado de servidor do cadastro de ativos
// (posição, categoria, identificador) via TanStack Query, nunca useEffect+carregar() manual
// (regra do CLAUDE.md). Cada hook recebe o gateway por parâmetro (mesmo padrão de
// operacao-queries.ts/resumo-inicio-queries.ts) — quem chama injeta o adapter singleton.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { criarCatalogoSimples, listarCatalogoSimples } from "./catalogos-simples";
import type { CatalogosSimplesGateway } from "./catalogos-simples-gateway";
import type { HierarquiaGateway } from "./hierarquia-gateway";
import { previsualizarIdentificador } from "./identificador-ativo";
import type { EntradaIdentificadorAtivo } from "./identificador-ativo";
import type { IdentificadorAtivoGateway } from "./identificador-ativo-gateway";

export const ativosClienteQueryKeys = {
  areas: (clienteId: string) => ["pcm", "ativos-cliente", clienteId, "areas"] as const,
  locais: (clienteId: string) => ["pcm", "ativos-cliente", clienteId, "locais"] as const,
  categorias: () => ["pcm", "ativos", "categorias"] as const,
  previaIdentificador: (input: EntradaIdentificadorAtivo | null) =>
    [
      "pcm",
      "ativos",
      "previa-identificador",
      input?.clienteId ?? "",
      input?.areaId ?? "",
      input?.localId ?? "",
      input?.categoriaId ?? "",
      input?.nomeAtivo ?? "",
    ] as const,
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

/** Preview somente no servidor de dados: a UI mantém o último resultado enquanto o usuário edita. */
export function usePreviaIdentificador(
  gateway: IdentificadorAtivoGateway,
  input: EntradaIdentificadorAtivo | null,
) {
  return useQuery({
    queryKey: ativosClienteQueryKeys.previaIdentificador(input),
    queryFn: () => {
      if (!input) throw new Error("Dados insuficientes para gerar o identificador.");
      return previsualizarIdentificador(gateway, input);
    },
    enabled: Boolean(input?.clienteId && input.categoriaId && input.nomeAtivo.trim()),
    placeholderData: keepPreviousData,
  });
}
