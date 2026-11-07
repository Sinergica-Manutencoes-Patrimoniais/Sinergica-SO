// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AptidaoChamado } from "./AptidaoChamado";

const respostas = vi.hoisted(() => ({ resumo: {} as unknown, itens: [] as unknown[] }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) }, schema: () => ({ rpc: (nome: string) => ({ abortSignal: async () => ({
    data: nome === "sso_diagnosticar_aptidao_chamado" ? respostas.resumo : respostas.itens,
    error: null,
  }) }) }) },
}));
afterEach(cleanup);

it("não mostra aptidão quando o diagnóstico não contém contagens obrigatórias", async () => {
  respostas.resumo = { aptoIndicativo: true };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AptidaoChamado usuario="u" cliente="c" chamado="h" /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Diagnóstico indisponível");
  expect(screen.queryByText(/apto indicativo/)).toBeNull();
});

it("mostra fotografia completa válida sem substituir revalidação no servidor", async () => {
  respostas.resumo = { revision: 2, encerrado: false, composicaoCompleta: true, parcelas: 1,
    parcelasPendentesOuInconsistentes: 0, continuacoesPendentes: 0, continuacoesInconsistentes: 0,
    ordensCliente: 1, ordensNaoFinalizadas: 0, ordensClienteDivergente: 0,
    aptoIndicativo: true, revalidacaoTransacionalObrigatoria: true };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AptidaoChamado usuario="u" cliente="c" chamado="h" /></QueryClientProvider>);
  expect(await screen.findByText(/apto indicativo/)).toBeTruthy();
  expect(screen.getByText(/o servidor deve revalidar/)).toBeTruthy();
});

it("rejeita aptidão contraditória com OS não finalizada", async () => {
  respostas.resumo = { revision: 2, encerrado: false, composicaoCompleta: true, parcelas: 1,
    parcelasPendentesOuInconsistentes: 0, continuacoesPendentes: 0, continuacoesInconsistentes: 0,
    ordensCliente: 1, ordensNaoFinalizadas: 1, ordensClienteDivergente: 0,
    aptoIndicativo: true, revalidacaoTransacionalObrigatoria: true };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AptidaoChamado usuario="u" cliente="c" chamado="h" /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Diagnóstico indisponível");
  expect(screen.queryByText(/apto indicativo/)).toBeNull();
});
