// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) },
    schema: () => ({ rpc: api.rpc }),
  },
}));
vi.mock("./diagnostico-revisao-sessao", () => ({
  conferirSessaoDiagnostico: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./FilaAposPreparacao", () => ({
  FilaAposPreparacao: ({ preparadaId, tipo }: { preparadaId: string; tipo: string }) => (
    <p>
      Fila {tipo}: {preparadaId}
    </p>
  ),
}));
import { MaterializarVisitaLegado } from "./MaterializarVisitaLegado";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
it("encaminha Visita integrada para conferência independente da fila", async () => {
  api.rpc.mockImplementation((nome, p) =>
    nome === "sso_visitas_legadas_mediadas"
      ? {
          abortSignal: async () => ({
            data: [
              {
                preparada_id: id(1),
                visita_id: id(2),
                serie_id: id(3),
                semana_origem: "2026-11-02",
                vencimento_original: "2026-11-06",
                alvo_tipo: "sistema",
                alvo_id: id(4),
              },
            ],
            error: null,
          }),
        }
      : Promise.resolve({
          data: {
            requestId: p.p_request_id,
            preparadaId: p.p_preparada_id,
            ocorrenciaLegadaCriada: true,
            planoLegadoCriado: false,
            osCriada: false,
            tarefaAuvoCriada: false,
            filaOficialIntegrada: false,
            fonteFeriadosCompleta: false,
          },
          error: null,
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MaterializarVisitaLegado
        userId="usuario"
        clienteId={id(5)}
        planoId={id(6)}
        legadoId={id(7)}
        relacaoId={id(8)}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: /2026-11-06/ });
  fireEvent.change(screen.getByLabelText("Ocorrência preparada"), { target: { value: id(1) } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi a visita/i }));
  fireEvent.click(screen.getByRole("button", { name: "Processar Visita" }));
  expect(await screen.findByText(`Fila visita: ${id(1)}`)).toBeInTheDocument();
  expect(api.rpc.mock.calls.filter(([nome]) => nome === "sso_alterar_fila_visita")).toHaveLength(0);
});

it("pré-seleciona a Visita da jornada sem enviar vínculo automaticamente", async () => {
  api.rpc.mockImplementation((nome) =>
    nome === "sso_visitas_legadas_mediadas"
      ? {
          abortSignal: async () => ({
            data: [
              {
                preparada_id: id(1),
                visita_id: id(2),
                serie_id: id(3),
                semana_origem: "2026-11-02",
                vencimento_original: "2026-11-06",
                alvo_tipo: "sistema",
                alvo_id: id(4),
              },
            ],
            error: null,
          }),
        }
      : Promise.resolve({ data: null, error: null }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MaterializarVisitaLegado
        userId="usuario"
        clienteId={id(5)}
        planoId={id(6)}
        legadoId={id(7)}
        relacaoId={id(8)}
        preparadaInicial={id(1)}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: /2026-11-06/ });
  expect(screen.getByLabelText("Ocorrência preparada")).toHaveValue(id(1));
  expect(screen.getByRole("button", { name: "Processar Visita" })).toBeDisabled();
  expect(
    api.rpc.mock.calls.filter(([nome]) => nome === "sso_materializar_visita_legada_mediada"),
  ).toHaveLength(0);
});
