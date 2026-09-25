/** E01-S147: KPI leve do PCM pro card da tela Início — RPC `fn_kpis_ordens_servico` (mesma fonte
 * do hub de OS), nunca a pipeline pesada de `montarDashboardPcm` (múltiplos fetches de OS/
 * inspeções/agenda que a página cheia do PCM precisa, o card do Início não). */
import { useQuery } from "@tanstack/react-query";
import type { HubOsGateway } from "./hub-os-gateway";

export const resumoInicioQueryKeys = {
  pcm: () => ["pcm", "resumo-inicio"] as const,
};

export function usePcmResumoInicio(gateway: HubOsGateway, habilitado = true) {
  return useQuery({
    queryKey: resumoInicioQueryKeys.pcm(),
    queryFn: () => gateway.contarKpis(),
    enabled: habilitado,
  });
}
