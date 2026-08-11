/** Queries do dashboard comercial (E03-S08), padrão TanStack Query do projeto. Só leitura — sem
 * mutation nesta story. */

import { useQuery } from "@tanstack/react-query";
import type { DashboardGateway, PeriodoDashboard } from "./dashboard-gateway";

export const dashboardQueryKeys = {
  conversao: (p: PeriodoDashboard) =>
    ["comercial", "dashboard", "conversao", p.inicio, p.fim] as const,
  ciclo: (p: PeriodoDashboard) => ["comercial", "dashboard", "ciclo", p.inicio, p.fim] as const,
  winLoss: (p: PeriodoDashboard) =>
    ["comercial", "dashboard", "win-loss", p.inicio, p.fim] as const,
  ticket: (p: PeriodoDashboard) => ["comercial", "dashboard", "ticket", p.inicio, p.fim] as const,
  desconto: (p: PeriodoDashboard) =>
    ["comercial", "dashboard", "desconto", p.inicio, p.fim] as const,
  origem: (p: PeriodoDashboard) => ["comercial", "dashboard", "origem", p.inicio, p.fim] as const,
};

export function useConversaoEtapas(
  gateway: DashboardGateway,
  periodo: PeriodoDashboard,
  habilitado = true,
) {
  return useQuery({
    queryKey: dashboardQueryKeys.conversao(periodo),
    queryFn: () => gateway.conversaoEtapas(periodo),
    enabled: habilitado,
  });
}

export function useCicloVenda(
  gateway: DashboardGateway,
  periodo: PeriodoDashboard,
  habilitado = true,
) {
  return useQuery({
    queryKey: dashboardQueryKeys.ciclo(periodo),
    queryFn: () => gateway.cicloVenda(periodo),
    enabled: habilitado,
  });
}

export function useWinLoss(
  gateway: DashboardGateway,
  periodo: PeriodoDashboard,
  habilitado = true,
) {
  return useQuery({
    queryKey: dashboardQueryKeys.winLoss(periodo),
    queryFn: () => gateway.winLoss(periodo),
    enabled: habilitado,
  });
}

export function useTicketMedio(
  gateway: DashboardGateway,
  periodo: PeriodoDashboard,
  habilitado = true,
) {
  return useQuery({
    queryKey: dashboardQueryKeys.ticket(periodo),
    queryFn: () => gateway.ticketMedio(periodo),
    enabled: habilitado,
  });
}

export function useDescontoMedio(
  gateway: DashboardGateway,
  periodo: PeriodoDashboard,
  habilitado = true,
) {
  return useQuery({
    queryKey: dashboardQueryKeys.desconto(periodo),
    queryFn: () => gateway.descontoMedio(periodo),
    enabled: habilitado,
  });
}

export function useOrigemLeads(
  gateway: DashboardGateway,
  periodo: PeriodoDashboard,
  habilitado = true,
) {
  return useQuery({
    queryKey: dashboardQueryKeys.origem(periodo),
    queryFn: () => gateway.origemLeads(periodo),
    enabled: habilitado,
  });
}
