/** Hooks de dado do Marketing (E06-S01). TanStack Query, obrigatório em código novo — nada de
 * `useState` + `useEffect` + `carregar()` aqui (CLAUDE.md, constituição §III). */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { arvoreDoRelatorio } from "../domain/indicadores";
import type { Relatorio } from "../domain/indicadores";
import type { Periodo } from "../domain/periodo";
import { problemaDoPeriodo } from "../domain/periodo";
import { ordenarReceita, totaisDeReceita } from "../domain/receita-campanha";
import type {
  ColunaDeReceita,
  LinhaDeReceitaComRetorno,
  TotaisDeReceita,
} from "../domain/receita-campanha";
import type { MarketingGateway, NovoLinkRastreado } from "./marketing-gateway";

export const marketingQueryKeys = {
  raiz: ["marketing"] as const,
  contas: () => ["marketing", "contas"] as const,
  indicadores: (periodo: Periodo) => ["marketing", "indicadores", periodo.de, periodo.ate] as const,
  receita: (periodo: Periodo) => ["marketing", "receita", periodo.de, periodo.ate] as const,
  sincronizacoes: () => ["marketing", "sincronizacoes"] as const,
  links: () => ["marketing", "links"] as const,
};

export function useContasDeAnuncio(gateway: MarketingGateway) {
  return useQuery({
    queryKey: marketingQueryKeys.contas(),
    queryFn: () => gateway.listarContas(),
  });
}

/** AC-1/AC-2/AC-3: a árvore é montada no domínio, não no componente.
 * AC-7: `keepPreviousData` segura o resultado anterior enquanto o novo período carrega, e a
 * chave contém as duas datas — uma resposta velha que chega atrasada cai numa chave que não é
 * mais a observada e nunca sobrescreve o que está na tela. */
export function useIndicadores(gateway: MarketingGateway, periodo: Periodo) {
  const periodoValido = problemaDoPeriodo(periodo) === null;
  return useQuery<Relatorio>({
    queryKey: marketingQueryKeys.indicadores(periodo),
    queryFn: async () => arvoreDoRelatorio(await gateway.metricasDoPeriodo(periodo)),
    enabled: periodoValido,
    placeholderData: keepPreviousData,
  });
}

export interface ReceitaDoPeriodo {
  readonly linhas: readonly LinhaDeReceitaComRetorno[];
  readonly totais: TotaisDeReceita;
}

export function useReceitaPorCampanha(
  gateway: MarketingGateway,
  periodo: Periodo,
  coluna: ColunaDeReceita = "receitaCentavos",
) {
  const periodoValido = problemaDoPeriodo(periodo) === null;
  return useQuery<ReceitaDoPeriodo>({
    queryKey: [...marketingQueryKeys.receita(periodo), coluna],
    queryFn: async () => {
      const cruas = await gateway.receitaPorCampanha(periodo);
      return { linhas: ordenarReceita(cruas, coluna), totais: totaisDeReceita(cruas) };
    },
    enabled: periodoValido,
    placeholderData: keepPreviousData,
  });
}

export function useUltimasSincronizacoes(gateway: MarketingGateway, limite = 5) {
  return useQuery({
    queryKey: marketingQueryKeys.sincronizacoes(),
    queryFn: () => gateway.ultimasSincronizacoes(limite),
  });
}

export function useLinksRastreados(gateway: MarketingGateway, habilitado = true) {
  return useQuery({
    queryKey: marketingQueryKeys.links(),
    queryFn: () => gateway.listarLinksRastreados(),
    enabled: habilitado,
  });
}

/** Depois de sincronizar, todo número da tela mudou — invalida a raiz, não só uma chave. */
export function useSincronizar(gateway: MarketingGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entrada: { contaId: string; janelaDias?: number }) =>
      gateway.sincronizar(entrada.contaId, entrada.janelaDias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingQueryKeys.raiz });
    },
  });
}

export function useCriarLinkRastreado(gateway: MarketingGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (novo: NovoLinkRastreado) => gateway.criarLinkRastreado(novo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingQueryKeys.links() });
    },
  });
}

/** AC-15: vincular muda a atribuição, logo muda a receita por campanha. */
export function useVincularOportunidade(gateway: MarketingGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entrada: { entradaId: string; oportunidadeId: string }) =>
      gateway.vincularOportunidade(entrada.entradaId, entrada.oportunidadeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingQueryKeys.raiz });
    },
  });
}
