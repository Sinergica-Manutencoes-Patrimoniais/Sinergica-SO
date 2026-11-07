// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } },
}));
import { SnapshotCapacidade } from "./SnapshotCapacidade";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("mostra vínculo declarado no snapshot sem descontar novamente", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_V5_ENABLED", "true");
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        error: null,
        data: {
          clienteId: "c",
          semanaInicio: "2025-12-29",
          completude: "desconhecida",
          limiteFontesAtingido: false,
          limiteOcorrenciasAtingido: false,
          limiteOsSemVisitaAtingido: false,
          pendentesSemSemana: 0,
          osSemVisita: [],
          fontesVisita: [],
          ocorrenciasSemOs: [],
          limiteDisponibilidadesAtingido: false,
          disponibilidades: [
            {
              id: "d",
              funcionario_id: "f",
              semana_inicio: "2025-12-29",
              revisao: 1,
              destinados_minutos: 600,
              reservas_minutos: 60,
              ausencias_minutos: 30,
            },
          ],
          vinculosIntervalo: [
            {
              disponibilidade_id: "d",
              intervalo_id: "i",
              tipo: "reserva",
              revisao_vinculo: 1,
              incluido: true,
            },
          ],
          limiteVinculosIntervaloAtingido: false,
        },
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Disponibilidade líquida declarada: 510/);
  expect(screen.getByText(/Intervalo i · reserva · inclusão declarada/)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith("sso_snapshot_capacidade_autorizado", expect.objectContaining({ p_versao: 5 }));
});
it("rejeita disponibilidade duplicada do mesmo técnico", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_V4_ENABLED", "true");
  const registro = {
    id: "a",
    funcionario_id: "f",
    semana_inicio: "2025-12-29",
    revisao: 1,
    destinados_minutos: 600,
    reservas_minutos: 0,
    ausencias_minutos: 0,
  };
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        error: null,
        data: {
          clienteId: "c",
          semanaInicio: "2025-12-29",
          completude: "desconhecida",
          limiteFontesAtingido: false,
          limiteOcorrenciasAtingido: false,
          limiteOsSemVisitaAtingido: false,
          pendentesSemSemana: 0,
          osSemVisita: [],
          fontesVisita: [],
          ocorrenciasSemOs: [],
          limiteDisponibilidadesAtingido: false,
          disponibilidades: [registro, { ...registro, id: "b" }],
        },
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
});
it("recusa disponibilidade duplicada quando UUID do técnico muda de caixa", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_V4_ENABLED", "true");
  const registro = { id: "a", funcionario_id: "ABCDEFAB-1234-1234-1234-123456789ABC", semana_inicio: "2025-12-29", revisao: 1, destinados_minutos: 600, reservas_minutos: 0, ausencias_minutos: 0 };
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ error: null, data: {
    clienteId: "c", semanaInicio: "2025-12-29", completude: "desconhecida", limiteFontesAtingido: false, limiteOcorrenciasAtingido: false,
    limiteOsSemVisitaAtingido: false, pendentesSemSemana: 0, osSemVisita: [], fontesVisita: [], ocorrenciasSemOs: [],
    limiteDisponibilidadesAtingido: false, disponibilidades: [registro, { ...registro, id: "b", funcionario_id: "abcdefab-1234-1234-1234-123456789abc" }],
  } }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText(/Disponibilidade líquida declarada/)).not.toBeInTheDocument();
});
it("compara disponibilidade declarada com demanda sem apresentar saldo efetivo", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_V4_ENABLED", "true");
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        error: null,
        data: {
          clienteId: "c",
          semanaInicio: "2025-12-29",
          completude: "desconhecida",
          limiteFontesAtingido: false,
          limiteOcorrenciasAtingido: false,
          limiteOsSemVisitaAtingido: false,
          pendentesSemSemana: 0,
          osSemVisita: [],
          fontesVisita: [],
          ocorrenciasSemOs: [],
          limiteDisponibilidadesAtingido: false,
          disponibilidades: [
            {
              id: "a",
              funcionario_id: "f1",
              semana_inicio: "2025-12-29",
              revisao: 1,
              destinados_minutos: 600,
              reservas_minutos: 60,
              ausencias_minutos: 30,
            },
            {
              id: "b",
              funcionario_id: "f2",
              semana_inicio: "2025-12-29",
              revisao: 1,
              destinados_minutos: 300,
              reservas_minutos: 0,
              ausencias_minutos: 0,
            },
          ],
        },
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Disponibilidade líquida declarada: 810/);
  expect(screen.getByText(/sobreposição não verificada/)).toBeTruthy();
  expect(screen.queryByText(/Diferença aritmética declarada/)).toBeNull();
  expect(api.rpc).toHaveBeenCalledWith("sso_snapshot_capacidade_autorizado", expect.objectContaining({ p_versao: 4 }));
});
it("compara somente valores declarados e mantém demanda desconhecida explícita", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_V4_ENABLED", "true");
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ error: null, data: {
    clienteId: "c", semanaInicio: "2025-12-29", completude: "desconhecida", limiteFontesAtingido: false, limiteOcorrenciasAtingido: false, limiteOsSemVisitaAtingido: false, limiteDisponibilidadesAtingido: false, pendentesSemSemana: 0, osSemVisita: [], fontesVisita: [],
    ocorrenciasSemOs: [{ tipo: "visita", ocorrencia_id: "v", esforco_revision: 1, internos_minutos: 60, terceiros_minutos: 120, acompanhamento_minutos: 30 }],
    disponibilidades: [{ id: "a", funcionario_id: "f", semana_inicio: "2025-12-29", revisao: 1, destinados_minutos: 600, reservas_minutos: 60, ausencias_minutos: 30 }],
  } }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" /></QueryClientProvider>);
  await screen.findByText(/Diferença aritmética declarada: 420 minutos-homem/i);
  expect(screen.getByText(/não representa saldo operacional/i)).toBeTruthy();
  expect(screen.getByText(/Origens pendentes: 1/i)).toBeTruthy();
});
it("não soma OS finalizada mesmo com prova PCM, nem afirma ocorrência concluída", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_V3_ENABLED", "true");
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        error: null,
        data: {
          clienteId: "c",
          semanaInicio: "2025-12-29",
          completude: "desconhecida",
          limiteFontesAtingido: false,
          limiteOcorrenciasAtingido: false,
          limiteOsSemVisitaAtingido: false,
          pendentesSemSemana: 0,
          osSemVisita: [],
          ocorrenciasSemOs: [],
          fontesVisita: [
            {
              os_id: "os",
              os_status: "finalizado",
              ocorrencia_legada_id: "l",
              ocorrencia_preparada_id: "p",
              esforco_revision: 1,
              internos_minutos: 60,
              terceiros_minutos: 100,
              acompanhamento_minutos: 20,
              prova_finalizacao_pcm: "finalizacao_pcm_registrada",
            },
          ],
        },
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Interno declarado: 0/);
  expect(screen.getByText(/1 finalização individual registrada/)).toBeTruthy();
  expect(screen.getByText(/não comprova conclusão da ocorrência/)).toBeTruthy();
});

it("inclui OS sem Visita e avisa aquelas sem semana comprovada", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_V2_ENABLED", "true");
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        error: null,
        data: {
          clienteId: "c",
          semanaInicio: "2025-12-29",
          completude: "desconhecida",
          limiteFontesAtingido: false,
          limiteOcorrenciasAtingido: false,
          fontesVisita: [],
          ocorrenciasSemOs: [],
          limiteOsSemVisitaAtingido: false,
          pendentesSemSemana: 2,
          osSemVisita: [
            {
              os_id: "os",
              os_status: "em_execucao",
              data_referencia: "2026-01-01",
              origem_id: null,
              tipo: null,
              ocorrencia_legada_id: "legada",
              esforco_revision: 1,
              internos_minutos: 60,
              terceiros_minutos: 100,
              acompanhamento_minutos: 20,
            },
          ],
        },
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Interno declarado: 80/);
  expect(screen.getByText(/2 OS abertas sem semana comprovada/)).toBeTruthy();
  expect(api.rpc).toHaveBeenCalledWith("sso_snapshot_capacidade_autorizado", expect.objectContaining({ p_versao: 2 }));
});
it("soma fontes do mesmo snapshot separando terceiros e mantendo incompletude", async () => {
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        error: null,
        data: {
          clienteId: "c",
          semanaInicio: "2025-12-29",
          completude: "desconhecida",
          limiteFontesAtingido: false,
          limiteOcorrenciasAtingido: false,
          fontesVisita: [
            {
              os_id: "os",
              os_status: "em_execucao",
              ocorrencia_legada_id: "legada",
              ocorrencia_preparada_id: "prep",
              esforco_revision: 1,
              internos_minutos: 60,
              terceiros_minutos: 120,
              acompanhamento_minutos: 30,
            },
          ],
          ocorrenciasSemOs: [
            {
              tipo: "calendario",
              ocorrencia_id: "outra",
              esforco_revision: 1,
              internos_minutos: 30,
              terceiros_minutos: 60,
              acompanhamento_minutos: 15,
            },
          ],
        },
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" />
    </QueryClientProvider>,
  );
  await screen.findByText(/Interno declarado: 135/);
  expect(screen.getByText(/Terceiros declarados: 180/)).toBeTruthy();
  expect(screen.getByText(/não representa demanda completa/)).toBeTruthy();
});
it("rejeita snapshot devolvido para outro Cliente", async () => {
  api.rpc.mockReturnValue({
    abortSignal: () =>
      Promise.resolve({
        error: null,
        data: {
          clienteId: "outro",
          semanaInicio: "2025-12-29",
          completude: "desconhecida",
          limiteFontesAtingido: false,
          limiteOcorrenciasAtingido: false,
          fontesVisita: [],
          ocorrenciasSemOs: [],
        },
      }),
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
});

it("recusa OS cuja data de referência está fora da semana do snapshot", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_V2_ENABLED", "true");
  api.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ error: null, data: {
    clienteId: "c", semanaInicio: "2025-12-29", completude: "desconhecida",
    limiteFontesAtingido: false, limiteOcorrenciasAtingido: false,
    limiteOsSemVisitaAtingido: false, pendentesSemSemana: 0,
    fontesVisita: [], ocorrenciasSemOs: [], osSemVisita: [{ os_id: "os", os_status: "planejamento",
      data_referencia: "2026-01-05", origem_id: null, tipo: null, ocorrencia_legada_id: null,
      esforco_revision: 1, internos_minutos: 60, terceiros_minutos: 0, acompanhamento_minutos: 0 }],
  } }) });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/Interno declarado: 60/)).toBeNull();
});

it("oculta snapshot enquanto autorização é revalidada", async () => {
  const snapshot = { clienteId: "c", semanaInicio: "2025-12-29", completude: "desconhecida", limiteFontesAtingido: false, limiteOcorrenciasAtingido: false, fontesVisita: [], ocorrenciasSemOs: [] };
  let finalizar: ((valor: { error: { code: string }; data: null }) => void) | undefined;
  api.rpc.mockReturnValueOnce({ abortSignal: () => Promise.resolve({ error: null, data: snapshot }) })
    .mockReturnValueOnce({ abortSignal: () => new Promise((resolve) => { finalizar = resolve; }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SnapshotCapacidade userId="u" clienteId="c" semana="2025-12-29" /></QueryClientProvider>);
  await screen.findByText(/Interno declarado: 0/);
  void client.refetchQueries({ queryKey: ["capacidade-snapshot"] });
  await waitFor(() => expect(finalizar).toBeDefined());
  expect(screen.queryByText(/Interno declarado: 0/)).toBeNull();
  await act(async () => finalizar?.({ error: { code: "42501" }, data: null }));
  expect(await screen.findByRole("alert")).toBeTruthy();
});
