import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  FiltroPesquisaEstrutura,
  PesquisaEstruturaGateway,
} from "./pesquisa-estrutura-gateway";

export const pesquisaEstruturaQueryKeys = {
  resumoGrupo: (usuario: string, clienteId: string, grupoId: string | null) =>
    ["pesquisa-estrutura-grupo", usuario, clienteId, grupoId] as const,
  pesquisa: (filtro: Omit<FiltroPesquisaEstrutura, "apos">) =>
    [
      "pesquisa-estrutura",
      filtro.usuario,
      filtro.clienteId,
      filtro.busca,
      filtro.tipo,
      filtro.contexto?.tipo,
      filtro.contexto?.id,
    ] as const,
};
export function usePesquisaEstrutura(
  gateway: PesquisaEstruturaGateway,
  filtro: Omit<FiltroPesquisaEstrutura, "apos">,
) {
  return useInfiniteQuery({
    queryKey: pesquisaEstruturaQueryKeys.pesquisa(filtro),
    queryFn: ({ pageParam, signal }) => gateway.pesquisar({ ...filtro, apos: pageParam }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (pagina) => (pagina.length === 50 ? pagina.at(-1)?.chave : undefined),
    enabled: Boolean(filtro.usuario && filtro.clienteId),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

export function useResumoGrupoEstrutura(
  gateway: PesquisaEstruturaGateway,
  usuario: string,
  clienteId: string,
  grupoId: string | null,
) {
  return useQuery({
    queryKey: pesquisaEstruturaQueryKeys.resumoGrupo(usuario, clienteId, grupoId),
    queryFn: ({ signal }) =>
      grupoId ? gateway.obterResumoGrupo(usuario, clienteId, grupoId, signal) : null,
    enabled: Boolean(usuario && clienteId && grupoId),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
}
