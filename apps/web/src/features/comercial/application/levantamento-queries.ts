/** Queries e mutations do levantamento de pré-venda (E03-S05), padrão TanStack Query do projeto. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CriarLevantamentoCommand, LevantamentoGateway } from "./levantamento-gateway";

export const levantamentoQueryKeys = {
  daConta: (clienteId: string) => ["comercial", "levantamentos", "conta", clienteId] as const,
  itens: (inspecaoId: string) => ["comercial", "levantamentos", inspecaoId, "itens"] as const,
};

export function useLevantamentosDaConta(
  gateway: LevantamentoGateway,
  clienteId: string,
  habilitado = true,
) {
  return useQuery({
    queryKey: levantamentoQueryKeys.daConta(clienteId),
    queryFn: () => gateway.listarLevantamentosDaConta(clienteId),
    enabled: habilitado && !!clienteId,
  });
}

/** AC-4: itens do levantamento vinculado à proposta — só busca quando a tela de importação está
 * aberta (`habilitado`), pra não puxar itens de todo levantamento navegado. */
export function useItensLevantamento(
  gateway: LevantamentoGateway,
  inspecaoId: string | null,
  clienteId: string,
  habilitado = true,
) {
  return useQuery({
    queryKey: levantamentoQueryKeys.itens(inspecaoId ?? "nenhum"),
    queryFn: () => gateway.listarItensLevantamento(inspecaoId as string, clienteId),
    enabled: habilitado && inspecaoId !== null,
  });
}

export function useCriarLevantamento(gateway: LevantamentoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CriarLevantamentoCommand) => gateway.criarLevantamento(input),
    onSuccess: (_levantamento, input) => {
      queryClient.invalidateQueries({ queryKey: levantamentoQueryKeys.daConta(input.clienteId) });
    },
  });
}
