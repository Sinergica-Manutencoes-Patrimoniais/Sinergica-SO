// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const externo = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("./FilaPreventivaPcm", () => ({
  FilaPreventivaPcm: ({ preparadaId, tipo }: { preparadaId: string; tipo: string }) => (
    <p>
      Fila {tipo}: {preparadaId}
    </p>
  ),
}));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: externo.rpc }), auth: { getUser: externo.getUser } },
}));
import { LoteOcorrenciasVisita } from "./LoteOcorrenciasVisita";
import { LoteVisitaLegado } from "./LoteVisitaLegado";
const cliente = "16610000-0000-4000-8000-00000000000a";
const outro = "16610000-0000-4000-8000-00000000000b";
const plano = "16610000-0000-4000-8000-000000000121";
const versao = "16610000-0000-4000-8000-000000000122";
const rotina = "16610000-0000-4000-8000-000000000123";
const serie = "16610000-0000-4000-8000-000000000061";
const visita = "16610000-0000-4000-8000-000000000081";
const preparada = "16610000-0000-4000-8000-000000000131";
const legado = "16610000-0000-4000-8000-000000000145";
const relacao = "16610000-0000-4000-8000-000000000146";
const q = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const candidatos = [
  {
    visita_id: visita,
    semana_origem: "2026-10-05",
    vencimento_original: "2026-10-09",
    estado_visita: "planejada",
    feriado_declarado: false,
    vigencia_declarada: true,
    ocorrencia_preparada: false,
  },
] as const;
const visitas = [
  {
    preparada_id: preparada,
    visita_id: visita,
    semana_origem: "2026-10-05",
    vencimento_original: "2026-10-09",
    alvo_tipo: "sistema",
    alvo_id: "16610000-0000-4000-8000-000000000120",
  },
] as const;
function canonico(
  query: QueryClient,
  clienteId = cliente,
  dados: Array<{
    visita_id: string;
    semana_origem: string;
    vencimento_original: string;
    estado_visita: string;
    feriado_declarado: boolean;
    vigencia_declarada: boolean;
    ocorrencia_preparada: boolean;
  }> = [...candidatos],
) {
  return (
    <QueryClientProvider client={query}>
      <LoteOcorrenciasVisita
        userId="usuario"
        clienteId={clienteId}
        planoId={plano}
        versaoId={versao}
        rotinaId={rotina}
        serieId={serie}
        revision={3}
        candidatos={dados}
        consultando={false}
      />
    </QueryClientProvider>
  );
}
function anterior(
  query: QueryClient,
  clienteId = cliente,
  dados: Array<{
    preparada_id: string;
    visita_id: string;
    semana_origem: string;
    vencimento_original: string;
    alvo_tipo: string;
    alvo_id: string;
  }> = [...visitas],
) {
  return (
    <QueryClientProvider client={query}>
      <LoteVisitaLegado
        userId="usuario"
        clienteId={clienteId}
        planoId={plano}
        legadoId={legado}
        relacaoId={relacao}
        visitas={dados}
        consultando={false}
      />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  externo.getUser.mockResolvedValue({ data: { user: { id: "usuario" } }, error: null });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

it("não seleciona feriado declarado ou Visita sem vigência", () => {
  const bloqueadas = [
    { ...candidatos[0], feriado_declarado: true },
    {
      ...candidatos[0],
      visita_id: "16610000-0000-4000-8000-000000000082",
      vigencia_declarada: false,
    },
  ];
  render(canonico(q(), cliente, bloqueadas));
  expect(screen.getByRole("checkbox", { name: new RegExp(visita) })).toBeDisabled();
  expect(
    screen.getByRole("checkbox", { name: /16610000-0000-4000-8000-000000000082/ }),
  ).toBeDisabled();
});

it("não permite selecionar Grupo para integração legada", () => {
  render(anterior(q(), cliente, [{ ...visitas[0], alvo_tipo: "grupo" }]));
  expect(screen.getByRole("checkbox", { name: new RegExp(visita) })).toBeDisabled();
});

it("repete lote canônico incerto com mesmo Cliente, revisão e IDs", async () => {
  externo.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  render(canonico(q()));
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(visita) }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"), {
    target: { value: "Calendário PCM" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi cada visita/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar lote" }));
  const retry = await screen.findByRole("button", { name: "Repetir mesmo lote" });
  await waitFor(() => expect(retry).toBeEnabled());
  fireEvent.click(retry);
  await waitFor(() => expect(externo.rpc).toHaveBeenCalledTimes(2));
  expect(externo.rpc.mock.calls[0]?.[1]).toMatchObject({
    p_cliente_id: cliente,
    p_plano_id: plano,
    p_versao_id: versao,
    p_rotina_id: rotina,
    p_expected_revision: 3,
    p_itens: [{ visitaId: visita, fonteDiaUtil: "Calendário PCM" }],
  });
  expect(externo.rpc.mock.calls[1]?.[1]).toEqual(externo.rpc.mock.calls[0]?.[1]);
});

it("repete lote legado incerto com a mesma relação e seleção", async () => {
  externo.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  render(anterior(q()));
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(visita) }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi a relação/i }));
  fireEvent.click(screen.getByRole("button", { name: "Vincular lote" }));
  const retry = await screen.findByRole("button", { name: "Repetir mesmo lote" });
  await waitFor(() => expect(retry).toBeEnabled());
  fireEvent.click(retry);
  await waitFor(() => expect(externo.rpc).toHaveBeenCalledTimes(2));
  expect(externo.rpc.mock.calls[0]?.[1]).toMatchObject({
    p_cliente_id: cliente,
    p_plano_id: plano,
    p_legado_id: legado,
    p_relacao_id: relacao,
    p_preparadas: [preparada],
  });
  expect(externo.rpc.mock.calls[1]?.[1]).toEqual(externo.rpc.mock.calls[0]?.[1]);
});

it("não oferece tentativa canônica de outro Cliente após remontagem", async () => {
  externo.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  const tela = render(canonico(q()));
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(visita) }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"), {
    target: { value: "PCM" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi cada visita/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar lote" }));
  await screen.findByRole("button", { name: "Repetir mesmo lote" });
  tela.unmount();
  render(canonico(q(), outro));
  expect(screen.queryByRole("button", { name: "Repetir mesmo lote" })).toBeNull();
});

it("exige nova conferência quando a fonte ou a Visita muda", () => {
  const query = q();
  const tela = render(canonico(query));
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(visita) }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"), {
    target: { value: "PCM" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi cada visita/i }));
  expect(screen.getByRole("button", { name: "Preparar lote" })).toBeEnabled();
  tela.rerender(
    canonico(query, cliente, [{ ...candidatos[0], vencimento_original: "2026-10-10" }]),
  );
  expect(screen.getByRole("button", { name: "Preparar lote" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi cada visita/i }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"), {
    target: { value: "Outra fonte" },
  });
  expect(screen.getByRole("button", { name: "Preparar lote" })).toBeDisabled();
});

it("não envia lote ao trocar a sessão depois da conferência", async () => {
  externo.getUser.mockResolvedValue({ data: { user: { id: "outro" } }, error: null });
  render(canonico(q()));
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(visita) }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"), {
    target: { value: "PCM" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi cada visita/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar lote" }));
  await screen.findByText(/Resultado não confirmado/i);
  expect(externo.rpc).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Repetir mesmo lote" })).toBeInTheDocument();
});

it("encaminha as ocorrências retornadas pelo lote para conferência da fila", async () => {
  vi.stubEnv("VITE_SSO_FILA_VISITA_ENABLED", "true");
  externo.rpc.mockImplementation(async (_nome, p) => ({
    error: null,
    data: {
      requestId: p.p_request_id,
      atomico: true,
      osCriada: false,
      tarefaAuvoCriada: false,
      fonteFeriadosCompleta: false,
      itens: p.p_itens.map((i: { visitaId: string; ocorrenciaId: string }) => ({
        requestId: crypto.randomUUID(),
        visitaId: i.visitaId,
        ocorrenciaId: i.ocorrenciaId,
        cicloVisitaId: crypto.randomUUID(),
        criada: true,
        osCriada: false,
        tarefaAuvoCriada: false,
        fonteFeriadosCompleta: false,
      })),
    },
  }));
  render(canonico(q()));
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(visita) }));
  fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"), {
    target: { value: "PCM" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi cada visita/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar lote" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir inclusão na fila" }));
  const ocorrencia = externo.rpc.mock.calls[0]?.[1].p_itens[0].ocorrenciaId;
  expect(screen.getByText(`Fila visita: ${ocorrencia}`)).toBeInTheDocument();
  expect(externo.rpc).toHaveBeenCalledTimes(1);
});

it("permite conferir a fila depois de integrar Visitas ao legado", async () => {
  vi.stubEnv("VITE_SSO_FILA_VISITA_ENABLED", "true");
  externo.rpc.mockImplementation(async (_nome, p) => ({
    error: null,
    data: {
      requestId: p.p_request_id,
      itens: p.p_preparadas.map((preparadaId: string) => ({
        preparadaId,
        osCriada: false,
        tarefaAuvoCriada: false,
        planoLegadoCriado: false,
        filaOficialIntegrada: false,
      })),
      atomico: true,
      planoLegadoCriado: false,
      osCriada: false,
      tarefaAuvoCriada: false,
      filaOficialIntegrada: false,
    },
  }));
  render(anterior(q()));
  fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(visita) }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /conferi a relação/i }));
  fireEvent.click(screen.getByRole("button", { name: "Vincular lote" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir fila" }));
  expect(screen.getByText(`Fila visita: ${preparada}`)).toBeInTheDocument();
  expect(externo.rpc).toHaveBeenCalledTimes(1);
});
