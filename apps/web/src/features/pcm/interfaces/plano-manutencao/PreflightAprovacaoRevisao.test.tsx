// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("./AvaliacaoImpactoRevisao", () => ({ AvaliacaoImpactoRevisao: () => null }));
vi.mock("./PrecondicaoImpactos", () => ({ PrecondicaoImpactos: () => null }));
import { PreflightAprovacaoRevisao } from "./PreflightAprovacaoRevisao";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("oculta dados da revisão durante revalidação e após perda de acesso", async () => {
  vi.stubEnv("VITE_SSO_DIAGNOSTICOS_REVISAO_MEDIADOS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_CONFERENCIA_FUSO_SERIES_ENABLED", "false");
  const versaoId = "17690000-0000-4000-8000-000000000001";
  api.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
  const dados = {
    revisao: 1,
    vigenciaProposta: "2026-11-01",
    impactoCompletoComprovado: false,
    fusoPlanoDefinido: true,
    aprovacaoAutorizada: false,
    versaoAnteriorId: versaoId,
    rascunhoId: "17690000-0000-4000-8000-000000000002",
    snapshotAnteriorDisponivel: true,
    vigenciaAnteriorInicio: "2026-01-01",
    vigenciaAnteriorFim: null,
    aprovadasPotencialmenteConflitantes: 1,
  };
  let finalizar: ((v: { data: null; error: { code: string } }) => void) | undefined;
  api.rpc
    .mockReturnValueOnce({ abortSignal: () => Promise.resolve({ data: dados, error: null }) })
    .mockReturnValueOnce({
      abortSignal: () =>
        new Promise((resolve) => {
          finalizar = resolve;
        }),
    });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PreflightAprovacaoRevisao
        userId="u"
        clienteId="c"
        planoId="p"
        revisao={1}
        vigencia="2026-11-01"
      />
    </QueryClientProvider>,
  );
  await screen.findByText(new RegExp(versaoId));
  void client.refetchQueries({ queryKey: ["preflight-aprovacao-revisao"] });
  await waitFor(() => expect(finalizar).toBeDefined());
  expect(screen.queryByText(new RegExp(versaoId))).toBeNull();
  await act(async () => finalizar?.({ data: null, error: { code: "42501" } }));
  await screen.findByRole("alert");
  expect(screen.queryByText(new RegExp(versaoId))).toBeNull();
});
