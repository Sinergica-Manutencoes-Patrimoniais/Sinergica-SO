// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } },
}));
const oc = "00000000-0000-4000-8000-000000000001", viId = "00000000-0000-4000-8000-000000000002", plano = "00000000-0000-4000-8000-000000000003", rotina = "00000000-0000-4000-8000-000000000004", alvo = "00000000-0000-4000-8000-000000000005";
import { OcorrenciasSemOs } from "./OcorrenciasSemOs";
vi.mock("./EsforcoDeclarado", () => ({ EsforcoDeclarado: ({ origemTipo, osId }: { origemTipo: string; osId: string }) => <p>Editor {origemTipo} {osId}</p> }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("permite declarar esforço de ocorrência por calendário e por Visita", async () => {
  vi.stubEnv("VITE_SSO_ESFORCO_DECLARADO_ENABLED", "true");
  vi.stubEnv("VITE_SSO_ESFORCO_OCORRENCIA_VISITA_ENABLED", "true");
  const base = { vencimento_original: "2026-01-02", plano_id: plano, rotina_id: rotina, alvo_tipo: "grupo", alvo_id: alvo, esforco_revision: 0, internos_minutos: null, terceiros_minutos: null, acompanhamento_minutos: null, completude: "desconhecida" };
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [{ ...base, tipo: "calendario", ocorrencia_id: oc }, { ...base, tipo: "visita", ocorrencia_id: viId }], error: null }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OcorrenciasSemOs userId="u" clienteId="c" semana="2025-12-29" /></QueryClientProvider>);
  const botoes = await screen.findAllByRole("button", { name: /declarar esforço da ocorrência/i });
  expect(botoes).toHaveLength(2);
  fireEvent.click(botoes[0]!);
  expect(screen.getByText(`Editor ocorrencia ${oc}`)).toBeTruthy();
  fireEvent.click(botoes[1]!);
  expect(screen.getByText(`Editor ocorrencia_visita ${viId}`)).toBeTruthy();
});
it("mostra subtotal separado de ocorrência, sem declarar cobertura ou somar terceiro na equipe própria", async () => {
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [
          {
            tipo: "calendario",
            ocorrencia_id: oc,
            vencimento_original: "2026-01-02",
            plano_id: plano,
            rotina_id: rotina,
            alvo_tipo: "grupo",
            alvo_id: alvo,
            esforco_revision: 1,
            internos_minutos: null,
            terceiros_minutos: 120,
            acompanhamento_minutos: 30,
            completude: "desconhecida",
          },
        ],
        error: null,
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OcorrenciasSemOs userId="u" clienteId="c" semana="2025-12-29" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Interno declarado: 30/);
  expect(screen.getByText(/Terceiros declarados: 120/)).toBeTruthy();
  expect(screen.getByText(/não somar ao subtotal das OS/)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith("sso_ocorrencias_sem_os_autorizadas", {
    p_cliente_id: "c",
    p_semana_inicio: "2025-12-29",
    p_apos_tipo: null,
    p_apos_id: null,
    p_limite: 50,
  });
});
