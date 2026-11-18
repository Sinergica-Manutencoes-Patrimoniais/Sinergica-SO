// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AvaliacaoEscopo } from "./AvaliacaoEscopo";

vi.mock("../../infrastructure/supabase-chamados-os-encerramento-adapter", () => ({
  supabaseChamadosOsEncerramentoAdapter: {
    avaliar: async () => ({
      composicaoCompleta: true,
      parcelas: 1,
      parcelasPendentes: 0,
      ordens: 1,
      ordensNaoFinalizadas: 0,
      continuacoesPendentes: 0,
    }),
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function tela(podeAdministrar: boolean) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AvaliacaoEscopo
        usuario="u"
        cliente="c"
        chamado="h"
        chamadoEsperado="h"
        podeAdministrar={podeAdministrar}
      />
    </QueryClientProvider>,
  );
}

it("E00-S28: contexto de Chamado diferente do esperado não renderiza nada (não é 'desativado')", () => {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AvaliacaoEscopo
        usuario="u"
        cliente="c"
        chamado="h"
        chamadoEsperado="outro"
        podeAdministrar
      />
    </QueryClientProvider>,
  );
  expect(screen.queryByText(/Conferência de escopo/)).not.toBeInTheDocument();
  expect(screen.queryByText(/ainda não está ativado/)).not.toBeInTheDocument();
});

it("E00-S28: flag desligada mostra RecursoNaoAtivado para administrador, com flag e gate", () => {
  tela(true);
  expect(screen.getByText("Conferência de escopo do Chamado")).toBeInTheDocument();
  expect(screen.getByText("VITE_SSO_ESCOPO_CHAMADO_ENABLED")).toBeInTheDocument();
});

it("E00-S28: flag desligada não vaza nome técnico para quem não administra", () => {
  tela(false);
  expect(screen.queryByText("Conferência de escopo do Chamado")).not.toBeInTheDocument();
  expect(screen.queryByText("VITE_SSO_ESCOPO_CHAMADO_ENABLED")).not.toBeInTheDocument();
  expect(screen.getByText(/ainda não está disponível/i)).toBeInTheDocument();
});

it("flag ligada renderiza a conferência de escopo de verdade", async () => {
  vi.stubEnv("VITE_SSO_ESCOPO_CHAMADO_ENABLED", "true");
  tela(false);
  expect(await screen.findByText(/parcela\(s\)/)).toBeTruthy();
});
