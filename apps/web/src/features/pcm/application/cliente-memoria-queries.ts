// E02-S24 — hooks de dado de servidor da memória do Zé por cliente (alma + resumo rolante).
// TanStack Query obrigatório em código novo: a tela anterior lia a alma com
// `useState`+`useEffect`+`then(setConteudo)`, sem cache, sem invalidação e sem cancelamento.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { obterAlma, obterResumoMemoria, salvarAlma } from "./cliente-alma";
import type { ClienteAlmaGateway } from "./cliente-alma-gateway";

export const clienteMemoriaQueryKeys = {
  alma: (clienteId: string) => ["pcm", "cliente-alma", clienteId] as const,
  resumo: (clienteId: string) => ["pcm", "cliente-memoria-resumo", clienteId] as const,
};

export function useClienteAlma(gateway: ClienteAlmaGateway, clienteId: string) {
  return useQuery({
    queryKey: clienteMemoriaQueryKeys.alma(clienteId),
    queryFn: () => obterAlma(gateway, clienteId),
    enabled: Boolean(clienteId),
  });
}

export function useSalvarClienteAlma(gateway: ClienteAlmaGateway, clienteId: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: { conteudo: string; userId: string }) =>
      salvarAlma(gateway, clienteId, input.conteudo, input.userId),
    // Depois de escrever, invalida a chave — sem isso a tela segue mostrando o texto antigo até
    // o `staleTime` de 30s vencer.
    onSuccess: () => cache.invalidateQueries({ queryKey: clienteMemoriaQueryKeys.alma(clienteId) }),
  });
}

export function useClienteMemoriaResumo(gateway: ClienteAlmaGateway, clienteId: string) {
  return useQuery({
    queryKey: clienteMemoriaQueryKeys.resumo(clienteId),
    queryFn: () => obterResumoMemoria(gateway, clienteId),
    enabled: Boolean(clienteId),
  });
}
