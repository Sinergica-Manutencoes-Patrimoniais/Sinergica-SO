// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
vi.mock("./AvaliacaoImpactoRevisao", () => ({ AvaliacaoImpactoRevisao: () => null }));
vi.mock("./PrecondicaoImpactos", () => ({ PrecondicaoImpactos: () => null }));
import { PreflightAprovacaoRevisao } from "./PreflightAprovacaoRevisao";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("oculta dados da revisão durante revalidação e após perda de acesso", async () => {
  const dados = { impactoCompletoComprovado: false, fusoPlanoDefinido: true, aprovacaoAutorizada: false,
    versaoAnteriorId: "versao-confidencial", rascunhoId: "rascunho", snapshotAnteriorDisponivel: true,
    vigenciaAnteriorInicio: "2026-01-01", vigenciaAnteriorFim: null, aprovadasPotencialmenteConflitantes: 1 };
  let finalizar: ((v: { data: null; error: { code: string } }) => void) | undefined;
  api.rpc.mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: dados, error: null }) })
    .mockReturnValueOnce({ abortSignal: () => new Promise((resolve) => { finalizar = resolve; }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PreflightAprovacaoRevisao userId="u" clienteId="c" planoId="p" revisao={1} vigencia="2026-11-01" /></QueryClientProvider>);
  await screen.findByText(/versao-confidencial/);
  void client.refetchQueries({ queryKey: ["preflight-aprovacao-revisao"] });
  await waitFor(() => expect(finalizar).toBeDefined());
  expect(screen.queryByText(/versao-confidencial/)).toBeNull();
  await act(async () => finalizar?.({ data: null, error: { code: "42501" } }));
  await screen.findByRole("alert");
  expect(screen.queryByText(/versao-confidencial/)).toBeNull();
});
