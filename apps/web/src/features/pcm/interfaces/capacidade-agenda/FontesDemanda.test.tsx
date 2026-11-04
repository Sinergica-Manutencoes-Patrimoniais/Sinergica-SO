// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: api.schema, auth: { getUser: async () => ({ data: { user: { id: "user" } }, error: null }) } } }));
import { FontesDemanda } from "./FontesDemanda";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("separa subtotal próprio de terceiros, sem prometer cobertura completa", async () => {
  vi.stubEnv("VITE_SSO_RESUMO_ESFORCO_ENABLED", "true");
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [
          {
            vinculo_id: "00000000-0000-4000-8000-000000000001",
            visita_id: "00000000-0000-4000-8000-000000000010",
            os_id: "00000000-0000-4000-8000-000000000020",
            os_status: "em_execucao",
            ocorrencia_legada_id: null,
            ocorrencia_preparada_id: null,
            ciclo_id: null,
            inicio_em: "2026-10-27T12:00:00Z",
            fuso: "UTC",
            estimativa_os_minutos: 120,
            participantes: 1,
            deslocamento_visita_minutos: 0,
            completude: "desconhecida",
            esforco_revision: 1,
            internos_minutos: 60,
            terceiros_minutos: 120,
            acompanhamento_minutos: 30,
          },
        ],
        error: null,
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FontesDemanda userId="user" clienteId="cliente" semana="2026-10-26" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Interno declarado: 90/);
  expect(screen.getByText(/Terceiros declarados: 120/)).toBeTruthy();
  expect(screen.getByText(/Não representa demanda completa/)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith("sso_fontes_esforco_autorizadas", expect.anything());
});

it("consulta fontes mediadas no Cliente e semana selecionados", async () => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: [], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FontesDemanda userId="user" clienteId="cliente" semana="2026-10-26" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Nenhuma fonte nesta página/);
  expect(api.schema).toHaveBeenCalledWith("pcm");
  expect(api.rpc).toHaveBeenCalledWith("sso_fontes_demanda_autorizadas", {
    p_cliente_id: "cliente",
    p_semana_inicio: "2026-10-26",
    p_apos: null,
    p_limite: 50,
  });
});

it("exclui do subtotal OS diferentes ligadas à mesma ocorrência", async () => {
  vi.stubEnv("VITE_SSO_RESUMO_ESFORCO_ENABLED", "true");
  api.schema.mockReturnValue({ rpc: api.rpc });
  const fonte = {
    vinculo_id: "00000000-0000-4000-8000-000000000001",
    visita_id: "00000000-0000-4000-8000-000000000010",
    os_id: "00000000-0000-4000-8000-000000000020",
    os_status: "em_execucao",
    ocorrencia_legada_id: "legada",
    ocorrencia_preparada_id: "prep",
    ciclo_id: null,
    inicio_em: "2026-10-27T12:00:00Z",
    fuso: "UTC",
    estimativa_os_minutos: 60,
    participantes: 1,
    deslocamento_visita_minutos: 0,
    completude: "desconhecida",
    esforco_revision: 1,
    internos_minutos: 60,
    terceiros_minutos: 100,
    acompanhamento_minutos: 30,
  };
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        data: [fonte, { ...fonte, vinculo_id: "00000000-0000-4000-8000-000000000002", os_id: "00000000-0000-4000-8000-000000000021" }],
        error: null,
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FontesDemanda userId="user" clienteId="cliente" semana="2026-10-26" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Interno declarado: 0/);
  expect(screen.getByText(/conflitantes: 2/)).toBeTruthy();
  expect(screen.getByText(/foram excluídas do subtotal/)).toBeTruthy();
});
