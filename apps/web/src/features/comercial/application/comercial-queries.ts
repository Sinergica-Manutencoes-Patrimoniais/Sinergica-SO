/** Queries e mutations do Comercial (E03-S01), no padrão TanStack Query adotado como regra do
 * projeto pela E01-S145 (ver `CLAUDE.md` § Data fetching).
 *
 * Mesma forma de `features/pcm/application/operacao-queries.ts`: chaves num objeto, hooks aqui,
 * invalidação depois de escrever. Nenhuma tela chama `carregar()` à mão. */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ComercialGateway,
  CriarOportunidadeCommand,
  EditarEtapaCommand,
  EditarMotivoPerdaCommand,
  EtapaCommand,
  FiltroContas,
  MotivoPerdaCommand,
  MoverOportunidadeCommand,
} from "./comercial-gateway";

export const comercialQueryKeys = {
  contas: () => ["comercial", "contas"] as const,
  contasFiltradas: (filtro: FiltroContas) => ["comercial", "contas", filtro] as const,
  etapas: () => ["comercial", "etapas"] as const,
  motivos: () => ["comercial", "motivos"] as const,
  oportunidades: () => ["comercial", "oportunidades"] as const,
  oportunidadesDaConta: (clienteId: string) => ["comercial", "oportunidades", clienteId] as const,
};

/** Etapas e motivos são catálogo: mudam raramente e são lidos por quase toda tela do módulo.
 * 10 min de `staleTime` evita refetch a cada navegação (mesma escolha da E01-S145 para catálogos). */
const STALE_CATALOGO = 10 * 60 * 1000;

export function useEtapas(gateway: ComercialGateway, habilitado = true) {
  return useQuery({
    queryKey: comercialQueryKeys.etapas(),
    queryFn: () => gateway.listarEtapas(),
    staleTime: STALE_CATALOGO,
    enabled: habilitado,
  });
}

export function useMotivosPerda(gateway: ComercialGateway, habilitado = true) {
  return useQuery({
    queryKey: comercialQueryKeys.motivos(),
    queryFn: () => gateway.listarMotivosPerda(),
    staleTime: STALE_CATALOGO,
    enabled: habilitado,
  });
}

/** `keepPreviousData` é o que faz a lista não piscar ao trocar filtro — e, junto com a query key
 * carregando o filtro, garante que resposta de um filtro antigo não sobrescreva o atual. */
export function useContas(gateway: ComercialGateway, filtro: FiltroContas, habilitado = true) {
  return useQuery({
    queryKey: comercialQueryKeys.contasFiltradas(filtro),
    queryFn: () => gateway.listarContas(filtro),
    placeholderData: keepPreviousData,
    enabled: habilitado,
  });
}

export function useOportunidadesDaConta(
  gateway: ComercialGateway,
  clienteId: string,
  habilitado = true,
) {
  return useQuery({
    queryKey: comercialQueryKeys.oportunidadesDaConta(clienteId),
    queryFn: () => gateway.listarOportunidadesDaConta(clienteId),
    enabled: habilitado,
  });
}

/** Criar oportunidade muda a lista de Contas (a coluna de etapa) e a aba da Conta — por isso
 * invalida as duas famílias de chave, não só a que a tela atual está olhando. */
export function useCriarOportunidade(gateway: ComercialGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CriarOportunidadeCommand) => gateway.criarOportunidade(input),
    onSuccess: (_dado, input) => {
      queryClient.invalidateQueries({ queryKey: comercialQueryKeys.contas() });
      queryClient.invalidateQueries({
        queryKey: comercialQueryKeys.oportunidadesDaConta(input.clienteId),
      });
    },
  });
}

export function useMoverOportunidade(gateway: ComercialGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MoverOportunidadeCommand) => gateway.moverOportunidade(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comercialQueryKeys.contas() });
      queryClient.invalidateQueries({ queryKey: comercialQueryKeys.oportunidades() });
    },
  });
}

export function useCriarEtapa(gateway: ComercialGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EtapaCommand) => gateway.criarEtapa(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comercialQueryKeys.etapas() });
    },
  });
}

/** Editar etapa mexe em nome/cor/ativo, que aparecem na coluna de funil da Lista de Contas —
 * então invalida Contas também, senão a lista fica mostrando o rótulo antigo. */
export function useEditarEtapa(gateway: ComercialGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarEtapaCommand) => gateway.editarEtapa(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comercialQueryKeys.etapas() });
      queryClient.invalidateQueries({ queryKey: comercialQueryKeys.contas() });
    },
  });
}

export function useCriarMotivoPerda(gateway: ComercialGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MotivoPerdaCommand) => gateway.criarMotivoPerda(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comercialQueryKeys.motivos() });
    },
  });
}

export function useEditarMotivoPerda(gateway: ComercialGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarMotivoPerdaCommand) => gateway.editarMotivoPerda(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: comercialQueryKeys.motivos() });
    },
  });
}
