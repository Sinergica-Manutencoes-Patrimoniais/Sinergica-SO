// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  autorizarAcao: vi.fn(),
  listarPlanos: vi.fn(),
  listarVersoes: vi.fn(),
  listarRotinas: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: api,
}));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    schema: () => ({ rpc: api.rpc }),
    auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) },
  },
}));
import { PlanoManutencaoWorkspace } from "./Workspace";

const clienteId = "16500000-0000-4000-8000-00000000000a";
const planoId = "16500000-0000-4000-8000-000000000011";
const versaoId = "16500000-0000-4000-8000-000000000091";
const rotinaId = "16500000-0000-4000-8000-000000000081";
const client = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function fixtures() {
  vi.stubEnv("VITE_SSO_CONTRATO_PERGUNTA_MEDIADO_ENABLED", "true");
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([
    { id: planoId, clienteId, nome: "Preventivo", estado: "em_revisao", revisao: 7 },
  ]);
  api.listarVersoes.mockResolvedValue([
    {
      id: versaoId,
      planoId,
      numero: 2,
      estado: "rascunho",
      vigenciaInicio: null,
      vigenciaFim: null,
    },
  ]);
  api.listarRotinas.mockResolvedValue([
    {
      id: rotinaId,
      planoId,
      versaoId,
      nome: "Inspeção",
      alvoTipo: "sistema",
      alvoId: "alvo",
      alvoNome: "Extintores",
      alvoAtivo: true,
      modo: "calendario",
      intervalo: 1,
      unidade: "meses",
      dataBase: "2026-11-01",
      tempoMinutos: 45,
      tipoTempo: "total",
      toleranciaAntes: 0,
      toleranciaDepois: 0,
      instrucao: "Inspecionar",
      questionarioId: "q",
      questionarioNome: "Questionário",
    },
  ]);
  api.rpc.mockImplementation((nome: string) => ({
    abortSignal: async () => ({
      data:
        nome === "sso_listar_perguntas_mediado"
          ? [
              {
                indice: 1,
                pergunta_id: "p1",
                obrigatoria: null,
                contrato_atual: false,
                revisao_plano: null,
              },
            ]
          : nome === "sso_listar_evidencias_mediado"
            ? [
                {
                  indice: 1,
                  pergunta_id: "p1",
                  exigida: null,
                  contrato_atual: false,
                  revisao_plano: null,
                },
              ]
            : [],
      error: null,
    }),
  }));
}
function compor(q: QueryClient, id = clienteId, usuario = "usuario") {
  return (
    <QueryClientProvider client={q}>
      <PlanoManutencaoWorkspace userId={usuario} clienteId={id} clienteNome="Guainumbi" />
    </QueryClientProvider>
  );
}
async function abrir() {
  fireEvent.click(await screen.findByRole("button", { name: "Ver Rotinas de Preventivo" }));
  await screen.findByText("Inspeção");
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

it("não oferece contratos na revisão quando a flag específica está desligada", async () => {
  fixtures();
  vi.stubEnv("VITE_SSO_CONTRATO_PERGUNTAS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_CONTRATO_EVIDENCIA_ENABLED", "true");
  vi.stubEnv("VITE_SSO_CONTRATOS_EM_REVISAO_ENABLED", "false");
  render(compor(client()));
  await abrir();
  expect(screen.queryByRole("region", { name: "Obrigatoriedade das perguntas" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Exigência de evidência por pergunta" })).toBeNull();
});

it("oferece ambos contratos somente na versão rascunho quando as flags estão ligadas", async () => {
  fixtures();
  vi.stubEnv("VITE_SSO_CONTRATO_PERGUNTAS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_CONTRATO_EVIDENCIA_ENABLED", "true");
  vi.stubEnv("VITE_SSO_CONTRATOS_EM_REVISAO_ENABLED", "true");
  render(compor(client()));
  await abrir();
  expect(await screen.findByRole("region", { name: "Obrigatoriedade das perguntas" })).toBeTruthy();
  expect(
    await screen.findByRole("region", { name: "Exigência de evidência por pergunta" }),
  ).toBeTruthy();
  expect(screen.getByText(/esta conferência não aprova o Plano/i)).toBeTruthy();
});

it("oculta o Plano após revogação da autorização", async () => {
  fixtures();
  const q = client();
  render(compor(q));
  await abrir();
  api.autorizarAcao.mockResolvedValue(false);
  await act(async () => {
    await q.invalidateQueries({ queryKey: ["plano-manutencao-permissao", "usuario", clienteId] });
  });
  expect(await screen.findByText(/sem permissão para gerir Planos/i)).toBeTruthy();
  expect(screen.queryByText("Inspeção")).toBeNull();
});

it.each(["cliente", "usuário"])("oculta dados ao trocar %s", async (campo) => {
  fixtures();
  const q = client();
  const tela = render(compor(q));
  await abrir();
  tela.rerender(
    campo === "cliente" ? compor(q, "outro-cliente") : compor(q, clienteId, "outra-sessao"),
  );
  expect(screen.getByText("Inspeção")).not.toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(/contexto mudou/i);
});

it("oculta dados durante falha da autorização", async () => {
  fixtures();
  const q = client();
  render(compor(q));
  await abrir();
  api.autorizarAcao.mockRejectedValue({ code: "42501" });
  await act(async () => {
    await q.invalidateQueries({ queryKey: ["plano-manutencao-permissao", "usuario", clienteId] });
  });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/verificar acesso/i));
  expect(screen.queryByText("Inspeção")).toBeNull();
});

it("repete o mesmo pedido de obrigatoriedade após resultado incerto", async () => {
  fixtures();
  vi.stubEnv("VITE_SSO_CONTRATO_PERGUNTAS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_CONTRATOS_EM_REVISAO_ENABLED", "true");
  const consulta = api.rpc.getMockImplementation()!;
  api.rpc.mockImplementation((nome: string, args: unknown) =>
    nome === "sso_configurar_pergunta_mediada"
      ? Promise.resolve({ error: { code: "42501" } })
      : consulta(nome, args),
  );
  render(compor(client()));
  await abrir();
  const secao = await screen.findByRole("region", { name: "Obrigatoriedade das perguntas" });
  await within(secao).findByRole("option", { name: /p1/ });
  fireEvent.change(within(secao).getByLabelText("Pergunta"), { target: { value: "p1" } });
  fireEvent.change(await within(secao).findByLabelText("Resposta exigida"), {
    target: { value: "sim" },
  });
  fireEvent.change(within(secao).getByLabelText("Justificativa"), {
    target: { value: "Conferido pelo PCM" },
  });
  fireEvent.click(within(secao).getByRole("button", { name: "Guardar contrato na revisão 7" }));
  fireEvent.click(await within(secao).findByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() =>
    expect(
      api.rpc.mock.calls.filter(([nome]) => nome === "sso_configurar_pergunta_mediada"),
    ).toHaveLength(2),
  );
  const pedidos = api.rpc.mock.calls.filter(([nome]) => nome === "sso_configurar_pergunta_mediada");
  expect(pedidos[0]?.[1]).toMatchObject({
    p_cliente_id: clienteId,
    p_plano_id: planoId,
    p_versao_id: versaoId,
    p_rotina_id: rotinaId,
    p_expected_revision: 7,
    p_pergunta_id: "p1",
    p_obrigatoria: true,
  });
  expect(pedidos[1]?.[1]).toEqual(pedidos[0]?.[1]);
});
