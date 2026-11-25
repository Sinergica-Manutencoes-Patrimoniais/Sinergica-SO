// E02-S25 — dado de servidor da configuração do trigger automático, via TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type TriggerAutomaticoFormData,
  validarTriggerAutomatico,
} from "../domain/trigger-automatico";
import type { TriggerAutomaticoGateway } from "./trigger-automatico-gateway";

export const triggerAutomaticoQueryKeys = {
  config: (personaId: string) => ["atendimento", "trigger-automatico", personaId] as const,
};

export function useTriggerAutomatico(gateway: TriggerAutomaticoGateway, personaId: string) {
  return useQuery({
    queryKey: triggerAutomaticoQueryKeys.config(personaId),
    queryFn: () => gateway.obter(personaId),
    enabled: Boolean(personaId),
  });
}

export function useSalvarTriggerAutomatico(gateway: TriggerAutomaticoGateway, personaId: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (input: TriggerAutomaticoFormData & { userId: string }) => {
      const validado = validarTriggerAutomatico(input);
      return gateway.salvar({ ...validado, personaId, userId: input.userId });
    },
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: triggerAutomaticoQueryKeys.config(personaId) }),
  });
}
