/** Queries e mutations do motor de precificação (E03-S03), padrão TanStack Query do projeto
 * (`CLAUDE.md` § Data fetching). Gateway próprio, separado do `comercial-queries.ts`. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EditarMaterialCommand,
  EditarNivelTecnicoCommand,
  EditarParametrosPrecoCommand,
  MaterialCommand,
  NivelTecnico,
  NivelTecnicoCommand,
  PrecificacaoGateway,
} from "./precificacao-gateway";

export const precificacaoQueryKeys = {
  parametros: () => ["comercial", "precificacao", "parametros"] as const,
  niveis: () => ["comercial", "precificacao", "niveis"] as const,
  materiais: () => ["comercial", "precificacao", "materiais"] as const,
  cargosPcm: () => ["comercial", "precificacao", "cargos-pcm"] as const,
  aliquota: () => ["comercial", "precificacao", "aliquota"] as const,
  custoHoraNivel: (nivelId: string) =>
    ["comercial", "precificacao", "custo-hora", nivelId] as const,
};

// Catálogo muda raramente e é lido por toda tela de proposta — 10 min de staleTime evita
// refetch a cada navegação (mesma escolha da E01-S145 para catálogos).
const STALE_CATALOGO = 10 * 60 * 1000;

export function useParametrosPreco(gateway: PrecificacaoGateway, habilitado = true) {
  return useQuery({
    queryKey: precificacaoQueryKeys.parametros(),
    queryFn: () => gateway.obterParametros(),
    staleTime: STALE_CATALOGO,
    enabled: habilitado,
  });
}

export function useEditarParametrosPreco(gateway: PrecificacaoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarParametrosPrecoCommand) => gateway.editarParametros(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: precificacaoQueryKeys.parametros() });
    },
  });
}

export function useNiveisTecnico(gateway: PrecificacaoGateway, habilitado = true) {
  return useQuery({
    queryKey: precificacaoQueryKeys.niveis(),
    queryFn: () => gateway.listarNiveisTecnico(),
    staleTime: STALE_CATALOGO,
    enabled: habilitado,
  });
}

export function useCriarNivelTecnico(gateway: PrecificacaoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NivelTecnicoCommand) => gateway.criarNivelTecnico(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: precificacaoQueryKeys.niveis() });
    },
  });
}

export function useEditarNivelTecnico(gateway: PrecificacaoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarNivelTecnicoCommand) => gateway.editarNivelTecnico(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: precificacaoQueryKeys.niveis() });
    },
  });
}

/** Cargos reais de `pcm.funcionarios` para o seletor — nunca campo digitável (grafia
 * inconsistente em produção). `staleTime` maior ainda: cadastro de funcionário muda bem menos
 * que preço. */
export function useCargosPcm(gateway: PrecificacaoGateway, habilitado = true) {
  return useQuery({
    queryKey: precificacaoQueryKeys.cargosPcm(),
    queryFn: () => gateway.listarCargosPcm(),
    staleTime: STALE_CATALOGO,
    enabled: habilitado,
  });
}

export function useMateriais(gateway: PrecificacaoGateway, habilitado = true) {
  return useQuery({
    queryKey: precificacaoQueryKeys.materiais(),
    queryFn: () => gateway.listarMateriais(),
    staleTime: STALE_CATALOGO,
    enabled: habilitado,
  });
}

export function useCriarMaterial(gateway: PrecificacaoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MaterialCommand) => gateway.criarMaterial(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: precificacaoQueryKeys.materiais() });
    },
  });
}

export function useEditarMaterial(gateway: PrecificacaoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarMaterialCommand) => gateway.editarMaterial(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: precificacaoQueryKeys.materiais() });
    },
  });
}

/** Alíquota efetiva vigente — `staleTime` curto (1 min): depende da receita acumulada dos últimos
 * 12 meses, que muda todo dia útil com o caixa. */
export function useAliquotaVigente(gateway: PrecificacaoGateway, habilitado = true) {
  return useQuery({
    queryKey: precificacaoQueryKeys.aliquota(),
    queryFn: () => gateway.obterAliquotaVigente(),
    staleTime: 60_000,
    enabled: habilitado,
  });
}

export function useCustoHoraNivel(
  gateway: PrecificacaoGateway,
  nivel: NivelTecnico | null,
  habilitado = true,
) {
  return useQuery({
    queryKey: precificacaoQueryKeys.custoHoraNivel(nivel?.id ?? "nenhum"),
    queryFn: () => gateway.obterCustoHoraNivel(nivel as NivelTecnico),
    staleTime: 60_000,
    enabled: habilitado && nivel !== null,
  });
}
