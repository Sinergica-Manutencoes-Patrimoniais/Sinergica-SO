import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salvarGrupoQuantitativo } from "./estrutura-tecnica";
import type {
  ConsultaGruposGateway,
  EstruturaTecnicaGateway,
  SalvarGrupoCommand,
} from "./estrutura-tecnica-gateway";

const LIMITE = 50;
export const estruturaTecnicaQueryKeys = {
  grupos: (userId: string, clienteId: string) =>
    ["estrutura-tecnica", userId, clienteId, "grupos"] as const,
  historico: (userId: string, clienteId: string, grupoId: string) =>
    ["estrutura-tecnica", userId, clienteId, "historico", grupoId] as const,
};

export function useGruposQuantitativos(
  gateway: ConsultaGruposGateway & EstruturaTecnicaGateway,
  userId: string,
  clienteId: string,
  permitido: boolean,
) {
  const queryClient = useQueryClient();
  const queryKey = estruturaTecnicaQueryKeys.grupos(userId, clienteId);
  const grupos = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => gateway.listarGrupos(clienteId, pageParam, LIMITE, signal),
    getNextPageParam: (ultima, todas) =>
      ultima.length === LIMITE ? todas.length * LIMITE : undefined,
    enabled: Boolean(userId && clienteId && permitido),
    gcTime: 0,
  });
  const salvar = useMutation({
    mutationFn: (comando: SalvarGrupoCommand) => salvarGrupoQuantitativo(gateway, comando),
    onSuccess: async (_resultado, comando) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: estruturaTecnicaQueryKeys.historico(userId, clienteId, comando.grupoId),
        }),
      ]);
    },
  });
  return { grupos, salvar };
}
