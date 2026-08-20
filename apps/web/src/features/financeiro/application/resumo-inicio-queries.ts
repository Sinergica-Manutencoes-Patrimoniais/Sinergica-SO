/** E01-S147: KPI leve do Financeiro pro card da tela Início — mesmo `ResumoCaixa` que
 * `FinanceiroDashboardPage` já busca, formatado em R$ via `centavosParaReais` (nunca centavos
 * crus na UI). */
import { useQuery } from "@tanstack/react-query";
import { obterResumoCaixa } from "./dashboard";
import type { FinanceiroGateway } from "./financeiro-gateway";

export const resumoInicioQueryKeys = {
  financeiro: () => ["financeiro", "resumo-inicio"] as const,
};

export function useFinanceiroResumoInicio(gateway: FinanceiroGateway, habilitado = true) {
  return useQuery({
    queryKey: resumoInicioQueryKeys.financeiro(),
    queryFn: () => obterResumoCaixa(gateway),
    enabled: habilitado,
  });
}
