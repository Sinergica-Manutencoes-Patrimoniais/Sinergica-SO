import { useQuery } from "@tanstack/react-query";
import type { DetalheSistemaGateway } from "./detalhe-sistema-gateway";

export const detalheSistemaQueryKeys = {
  cadastro: (sistemaId: string, clienteId?: string) =>
    ["pcm", "detalhe-sistema", sistemaId, clienteId ?? ""] as const,
  componentes: (sistemaId: string, clienteId: string) =>
    ["pcm", "detalhe-sistema", sistemaId, clienteId, "componentes"] as const,
  os: (sistemaId: string, clienteId: string) =>
    ["pcm", "detalhe-sistema", sistemaId, clienteId, "os"] as const,
  preventivas: (sistemaId: string, clienteId: string) =>
    ["pcm", "detalhe-sistema", sistemaId, clienteId, "preventivas"] as const,
};

export function useCadastroSistema(
  gateway: DetalheSistemaGateway,
  sistemaId: string | null,
  clienteEsperadoId?: string,
) {
  return useQuery({
    queryKey: detalheSistemaQueryKeys.cadastro(sistemaId ?? "", clienteEsperadoId),
    queryFn: () => gateway.obterCadastro(sistemaId ?? "", clienteEsperadoId),
    enabled: Boolean(sistemaId),
  });
}

export function useComponentesSistema(
  gateway: DetalheSistemaGateway,
  sistemaId: string | null,
  clienteId: string | null,
) {
  return useQuery({
    queryKey: detalheSistemaQueryKeys.componentes(sistemaId ?? "", clienteId ?? ""),
    queryFn: () => gateway.listarComponentes(sistemaId ?? "", clienteId ?? ""),
    enabled: Boolean(sistemaId && clienteId),
  });
}

export function useOsSistema(
  gateway: DetalheSistemaGateway,
  sistemaId: string | null,
  clienteId: string | null,
) {
  return useQuery({
    queryKey: detalheSistemaQueryKeys.os(sistemaId ?? "", clienteId ?? ""),
    queryFn: () => gateway.listarOs(sistemaId ?? "", clienteId ?? ""),
    enabled: Boolean(sistemaId && clienteId),
  });
}

export function usePreventivasSistema(
  gateway: DetalheSistemaGateway,
  sistemaId: string | null,
  clienteId: string | null,
) {
  return useQuery({
    queryKey: detalheSistemaQueryKeys.preventivas(sistemaId ?? "", clienteId ?? ""),
    queryFn: () => gateway.listarPreventivas(sistemaId ?? "", clienteId ?? ""),
    enabled: Boolean(sistemaId && clienteId),
  });
}
