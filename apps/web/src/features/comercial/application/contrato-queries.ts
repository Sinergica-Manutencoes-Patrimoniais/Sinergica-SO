/** Queries e mutations do contrato comercial (E03-S07), padrão TanStack Query do projeto. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ContratoGateway,
  EditarContratoCommand,
  EncerrarContratoCommand,
} from "./contrato-gateway";

export const contratoQueryKeys = {
  todos: ["comercial", "contratos"] as const,
  daConta: (clienteId: string) => ["comercial", "contratos", "conta", clienteId] as const,
};

export function useContratos(gateway: ContratoGateway, habilitado = true) {
  return useQuery({
    queryKey: contratoQueryKeys.todos,
    queryFn: () => gateway.listarContratos(),
    enabled: habilitado,
  });
}

export function useContratosDaConta(
  gateway: ContratoGateway,
  clienteId: string,
  habilitado = true,
) {
  return useQuery({
    queryKey: contratoQueryKeys.daConta(clienteId),
    queryFn: () => gateway.listarContratosDaConta(clienteId),
    enabled: habilitado && !!clienteId,
  });
}

function invalidarTudo(queryClient: ReturnType<typeof useQueryClient>, clienteId?: string) {
  queryClient.invalidateQueries({ queryKey: contratoQueryKeys.todos });
  if (clienteId) {
    queryClient.invalidateQueries({ queryKey: contratoQueryKeys.daConta(clienteId) });
  }
}

export function useCriarContrato(gateway: ContratoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (propostaId: string) => gateway.criarContrato(propostaId),
    onSuccess: (contrato) => invalidarTudo(queryClient, contrato.clienteId),
  });
}

export function useEditarContrato(gateway: ContratoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarContratoCommand) => gateway.editarContrato(input),
    onSuccess: (contrato) => invalidarTudo(queryClient, contrato.clienteId),
  });
}

export function useAtivarContrato(gateway: ContratoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contratoId: string) => gateway.ativarContrato(contratoId),
    onSuccess: (contrato) => invalidarTudo(queryClient, contrato.clienteId),
  });
}

export function useEncerrarContrato(gateway: ContratoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EncerrarContratoCommand) => gateway.encerrarContrato(input),
    onSuccess: (contrato) => invalidarTudo(queryClient, contrato.clienteId),
  });
}
