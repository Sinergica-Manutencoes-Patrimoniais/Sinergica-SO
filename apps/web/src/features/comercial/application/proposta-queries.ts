/** Queries e mutations do editor de proposta (E03-S04), padrão TanStack Query do projeto. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { montarComandoSalvarComposicao } from "./proposta";
import type { MontarComposicaoInput } from "./proposta";
import type {
  CriarPropostaCommand,
  ForcarPrecoCommand,
  MudarStatusCommand,
  PropostaGateway,
  VincularAssessmentCommand,
} from "./proposta-gateway";

export const propostaQueryKeys = {
  daOportunidade: (oportunidadeId: string) =>
    ["comercial", "propostas", "oportunidade", oportunidadeId] as const,
  proposta: (id: string) => ["comercial", "propostas", id] as const,
  itens: (propostaId: string) => ["comercial", "propostas", propostaId, "itens"] as const,
  versoes: (propostaId: string) => ["comercial", "propostas", propostaId, "versoes"] as const,
};

export function usePropostasDaOportunidade(
  gateway: PropostaGateway,
  oportunidadeId: string,
  habilitado = true,
) {
  return useQuery({
    queryKey: propostaQueryKeys.daOportunidade(oportunidadeId),
    queryFn: () => gateway.listarPropostasDaOportunidade(oportunidadeId),
    enabled: habilitado && !!oportunidadeId,
  });
}

export function useProposta(gateway: PropostaGateway, propostaId: string | null) {
  return useQuery({
    queryKey: propostaQueryKeys.proposta(propostaId ?? "nenhuma"),
    queryFn: () => gateway.obterProposta(propostaId as string),
    enabled: propostaId !== null,
  });
}

export function usePropostaItens(gateway: PropostaGateway, propostaId: string | null) {
  return useQuery({
    queryKey: propostaQueryKeys.itens(propostaId ?? "nenhuma"),
    queryFn: () => gateway.listarItens(propostaId as string),
    enabled: propostaId !== null,
  });
}

export function usePropostaVersoes(gateway: PropostaGateway, propostaId: string | null) {
  return useQuery({
    queryKey: propostaQueryKeys.versoes(propostaId ?? "nenhuma"),
    queryFn: () => gateway.listarVersoes(propostaId as string),
    enabled: propostaId !== null,
  });
}

export function useCriarProposta(gateway: PropostaGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CriarPropostaCommand) => gateway.criarProposta(input),
    onSuccess: (_dado, input) => {
      queryClient.invalidateQueries({
        queryKey: propostaQueryKeys.daOportunidade(input.oportunidadeId),
      });
    },
  });
}

/** Orquestra `montarComandoSalvarComposicao` (domínio + itens) e chama o gateway — a mutation é
 * o único lugar que precisa saber que essas duas coisas existem juntas. */
export function useSalvarComposicao(gateway: PropostaGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MontarComposicaoInput) =>
      gateway.salvarComposicao(montarComandoSalvarComposicao(input)),
    onSuccess: (proposta) => {
      queryClient.invalidateQueries({ queryKey: propostaQueryKeys.proposta(proposta.id) });
      queryClient.invalidateQueries({ queryKey: propostaQueryKeys.itens(proposta.id) });
      queryClient.invalidateQueries({ queryKey: propostaQueryKeys.versoes(proposta.id) });
      queryClient.invalidateQueries({
        queryKey: propostaQueryKeys.daOportunidade(proposta.oportunidadeId),
      });
    },
  });
}

export function useMudarStatusProposta(gateway: PropostaGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MudarStatusCommand) => gateway.mudarStatus(input),
    onSuccess: (proposta) => {
      queryClient.invalidateQueries({ queryKey: propostaQueryKeys.proposta(proposta.id) });
      queryClient.invalidateQueries({
        queryKey: propostaQueryKeys.daOportunidade(proposta.oportunidadeId),
      });
    },
  });
}

export function useVincularAssessment(gateway: PropostaGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VincularAssessmentCommand) => gateway.vincularAssessment(input),
    onSuccess: (proposta) => {
      queryClient.invalidateQueries({ queryKey: propostaQueryKeys.proposta(proposta.id) });
      queryClient.invalidateQueries({
        queryKey: propostaQueryKeys.daOportunidade(proposta.oportunidadeId),
      });
    },
  });
}

export function useForcarPrecoAbaixoPiso(gateway: PropostaGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ForcarPrecoCommand) => gateway.forcarPrecoAbaixoDoPiso(input),
    onSuccess: (proposta) => {
      queryClient.invalidateQueries({ queryKey: propostaQueryKeys.proposta(proposta.id) });
      queryClient.invalidateQueries({ queryKey: propostaQueryKeys.versoes(proposta.id) });
    },
  });
}

export function useDuplicarProposta(gateway: PropostaGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (propostaId: string) => gateway.duplicarProposta(propostaId),
    onSuccess: (proposta) => {
      queryClient.invalidateQueries({
        queryKey: propostaQueryKeys.daOportunidade(proposta.oportunidadeId),
      });
    },
  });
}
