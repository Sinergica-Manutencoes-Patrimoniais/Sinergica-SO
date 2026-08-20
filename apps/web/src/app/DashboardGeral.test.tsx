// @vitest-environment jsdom
// E01-S147: cobre AC-1/2/3 (dado real por módulo), AC-4/5 (loading/erro independente por card),
// AC-6 (empty state honesto pra módulo sem dado real) e AC-8 (navegação). Mocka os adapters
// (singletons importados direto pelos hooks) — não bate em rede real.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  contarKpis: vi.fn(),
  obterSnapshot: vi.fn(),
  obterResumoCaixa: vi.fn(),
}));

vi.mock("../features/pcm/infrastructure/supabase-hub-os-adapter", () => ({
  supabaseHubOsAdapter: { contarKpis: mocks.contarKpis },
}));
vi.mock("../features/atendimento/infrastructure/supabase-dashboard-atendimento-adapter", () => ({
  supabaseDashboardAtendimentoAdapter: { obterSnapshot: mocks.obterSnapshot },
}));
vi.mock("../features/financeiro/infrastructure/supabase-financeiro-adapter", () => ({
  supabaseFinanceiroAdapter: { obterResumoCaixa: mocks.obterResumoCaixa },
}));

import { DashboardGeral } from "./DashboardGeral";
import type { ModuloId } from "./modulos";

const SNAPSHOT_ATENDIMENTO = {
  periodo: "hoje" as const,
  filaSemAtendente: 2,
  abertas: 7,
  naoLidas: 4,
  maisAntigaNaFilaSegundos: null,
  abertasHoje: 3,
  abertasOntem: 2,
  aging: [],
  frtMedioSegundos: null,
  mixCanal: [],
  mixModo: [],
  autonomiaZe: 0,
  autonomiaHumano: 0,
  escalonadoTotal: 0,
  encerradasTotal: 0,
};

const RESUMO_CAIXA = {
  posicaoCaixaCentavos: 123_456,
  entradasMesCentavos: 0,
  saidasMesCentavos: 0,
  resultadoMesCentavos: 78_900,
  aReceber30dCentavos: 45_600,
  aPagar30dCentavos: 0,
  entradasPrevistasMesCentavos: 0,
  saidasPrevistasMesCentavos: 0,
};

const KPIS_PCM = {
  total: 10,
  abertas: 5,
  emPlanejamento: 1,
  emExecucao: 9,
  finalizadas: 2,
  criticas: 6,
};

function Wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderDashboard(moduloIds: ModuloId[], onSelect = vi.fn()) {
  return {
    onSelect,
    ...render(<DashboardGeral moduloIds={moduloIds} onSelect={onSelect} />, { wrapper: Wrapper }),
  };
}

beforeEach(() => {
  mocks.contarKpis.mockReset();
  mocks.obterSnapshot.mockReset();
  mocks.obterResumoCaixa.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("DashboardGeral — E01-S147", () => {
  it("AC-1/2/3: mostra KPI real de PCM, Atendimento e Financeiro, não mock fixo", async () => {
    mocks.contarKpis.mockResolvedValue(KPIS_PCM);
    mocks.obterSnapshot.mockResolvedValue(SNAPSHOT_ATENDIMENTO);
    mocks.obterResumoCaixa.mockResolvedValue(RESUMO_CAIXA);

    renderDashboard(["pcm", "atendimento", "financeiro"]);

    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument()); // OS Abertas
    expect(screen.getByText("9")).toBeInTheDocument(); // Em Execução
    expect(screen.getByText("Fila sem atendente")).toBeInTheDocument();
    expect(screen.getByText("R$ 789,00")).toBeInTheDocument(); // Resultado do mês
    // valores do mock antigo (E01-S24) nunca devem sobreviver
    expect(screen.queryByText("SLA no Prazo")).not.toBeInTheDocument();
    expect(screen.queryByText("R$ 48,5k")).not.toBeInTheDocument();
  });

  it("AC-4: card de Financeiro pendente não trava PCM já pronto", async () => {
    mocks.contarKpis.mockResolvedValue(KPIS_PCM);
    mocks.obterResumoCaixa.mockImplementation(() => new Promise(() => {})); // nunca resolve

    renderDashboard(["pcm", "financeiro"]);

    await waitFor(() => expect(screen.getByText("OS Abertas")).toBeInTheDocument());
    // Financeiro ainda em loading — skeleton, sem KPI nem crash na tela toda
    expect(screen.queryByText("Posição de caixa")).not.toBeInTheDocument();
  });

  it("AC-5: card de Atendimento em erro mostra estado de erro, PCM continua normal", async () => {
    mocks.contarKpis.mockResolvedValue(KPIS_PCM);
    mocks.obterSnapshot.mockRejectedValue(new Error("RPC indisponível"));

    renderDashboard(["pcm", "atendimento"]);

    await waitFor(() =>
      expect(screen.getByText("Não foi possível carregar este módulo.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Tentar de novo")).toBeInTheDocument();
    expect(screen.getByText("OS Abertas")).toBeInTheDocument();
  });

  it("AC-6: módulo sem dado real (comercial) mostra empty state, nunca número inventado", () => {
    renderDashboard(["comercial"]);

    expect(screen.getByText("Sem dados disponíveis ainda")).toBeInTheDocument();
    expect(screen.queryByText("Leads ativos")).not.toBeInTheDocument();
    expect(mocks.contarKpis).not.toHaveBeenCalled();
  });

  it("AC-8: 'Ver módulo →' navega tanto no card real quanto no vazio", async () => {
    mocks.contarKpis.mockResolvedValue(KPIS_PCM);
    const { onSelect } = renderDashboard(["pcm", "marketing"]);

    await waitFor(() => expect(screen.getByText("OS Abertas")).toBeInTheDocument());
    const [botaoPcm, botaoMarketing] = screen.getAllByText("Ver módulo →");
    expect(botaoPcm).toBeDefined();
    expect(botaoMarketing).toBeDefined();
    botaoPcm?.click();
    expect(onSelect).toHaveBeenCalledWith("pcm");
    botaoMarketing?.click();
    expect(onSelect).toHaveBeenCalledWith("marketing");
  });
});
