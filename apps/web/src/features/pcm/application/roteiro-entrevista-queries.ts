// E02-S26 AC-1 — dado de servidor dos roteiros de entrevista, via TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RoteiroFormData, validarRoteiro } from "../domain/roteiro-entrevista";
import type { RoteiroEntrevistaGateway } from "./roteiro-entrevista-gateway";

export const roteiroEntrevistaQueryKeys = {
  lista: () => ["pcm", "roteiro-entrevista"] as const,
};

export function useRoteirosEntrevista(gateway: RoteiroEntrevistaGateway) {
  return useQuery({
    queryKey: roteiroEntrevistaQueryKeys.lista(),
    queryFn: () => gateway.listar(),
  });
}

export function useSalvarRoteiroEntrevista(gateway: RoteiroEntrevistaGateway) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: RoteiroFormData & { id?: string; userId: string }) => {
      const validado = validarRoteiro(input);
      return input.id
        ? gateway.editar({ ...validado, id: input.id, userId: input.userId })
        : gateway.criar({ ...validado, userId: input.userId });
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: roteiroEntrevistaQueryKeys.lista() }),
  });
}

export function useAlternarRoteiroEntrevista(gateway: RoteiroEntrevistaGateway) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; ativo: boolean; userId: string }) =>
      gateway.alternarAtivo(input),
    onSuccess: () => cache.invalidateQueries({ queryKey: roteiroEntrevistaQueryKeys.lista() }),
  });
}
