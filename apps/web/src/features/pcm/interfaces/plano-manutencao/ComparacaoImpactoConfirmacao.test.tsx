// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const externo = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: externo.rpc }), auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
import { DecisaoImpactoOcorrencia } from "./DecisaoImpactoOcorrencia";
import { DecisaoImpactoVisita } from "./DecisaoImpactoVisita";

const preparada = "16630000-1111-4000-8000-000000000061";
const rascunho = "16630000-1111-4000-8000-000000000022";
const rotinaId = "16630000-1111-4000-8000-000000000031";
const logica = "16630000-1111-4000-8000-000000000032";
const alvo = "16630000-1111-4000-8000-000000000033";
const visita = "16630000-1111-4000-8000-000000000081";
const ciclo = "16630000-1111-4000-8000-000000000082";
const usuario = "usuario"; const cliente = "cliente"; const plano = "plano"; const revision = 2;
const rotina = { id: rotinaId, nome: "Rotina original", alvo_tipo: "sistema", sistema_id: alvo, equipamento_id: null, grupo_id: null, modo: "calendario", intervalo_n: 1, intervalo_unidade: "meses", data_base: "2026-11-04", tempo_minutos: null, tipo_tempo: null, tolerancia_antes: 0, tolerancia_depois: 0, instrucao: null, questionario_id: null };
const comum = { preparada_id: preparada, rascunho_id: rascunho, rotina_id: rotinaId, revisao_decisao: 0, ultima_decisao: null, ultima_revisao_plano: null };
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); externo.rpc.mockReset(); });

it.each(["calendario", "visita"] as const)("exige nova confirmação ao mudar comparação ou data para %s", async (tipo) => {
  vi.stubEnv("VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED", "true");
  const linha = tipo === "calendario" ? { ...comum, ciclo: 1, vencimento_original: "2026-11-04", ultimo_motivo: null } : { ...comum, semana_origem: "2026-11-02", visita_id: visita, ciclo_canonico_id: ciclo };
  const comparacao = { preparadaId: preparada, rascunhoId: rascunho, revisaoPlano: revision, tipo, rotinaLogicaId: logica, alvoOcorrenciaTipo: "sistema", alvoOcorrenciaId: alvo, vencimentoOriginal: "2026-11-04", ciclo: tipo === "calendario" ? 1 : null, visitaId: tipo === "visita" ? visita : null, semanaOrigem: tipo === "visita" ? "2026-11-02" : null, anterior: rotina, rascunho: { ...rotina, nome: "Rascunho" }, questionarioComparacao: { estado: "sem_questionario", historicoHash: null, atualHash: null }, origemOcorrencia: { versaoId: "16630000-1111-4000-8000-000000000021", numero: 1, estado: "disponivel", rotina, questionarioEstado: "sem_questionario", questionarioHash: null }, osImpacto: [], osOutroCliente: false, fontesCompletas: false, aprovacaoAutorizada: false };
  externo.rpc.mockImplementation((nome: string) => ({ abortSignal: () => Promise.resolve({ data: nome === "sso_comparar_rotina_impacto_v3" ? comparacao : [linha], error: null }) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const props = { userId: usuario, clienteId: cliente, planoId: plano, revision };
  render(<QueryClientProvider client={client}>{tipo === "calendario" ? <DecisaoImpactoOcorrencia {...props} /> : <DecisaoImpactoVisita {...props} />}</QueryClientProvider>);
  const seletor = await screen.findByLabelText("Ocorrência");
  await screen.findByRole("option", { name: tipo === "calendario" ? /Ciclo 1/ : /Semana 2026-11-02/ });
  fireEvent.change(seletor, { target: { value: preparada } });
  await screen.findByText(/Versão anterior: Rotina original/);
  expect(screen.getByText(/Origem da ocorrência · versão 1: Rotina original/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  const confirmar = screen.getByRole("checkbox", { name: /Conferi a decisão parcial/ });
  const botao = screen.getByRole("button", { name: "Registrar decisão" });
  fireEvent.click(confirmar);
  expect(botao).toBeEnabled();
  const chaveComparacao = ["comparacao-impacto-selecionado", usuario, cliente, plano, revision, rascunho, preparada, tipo];
  act(() => client.setQueryData(chaveComparacao, { ...comparacao, rascunho: { ...rotina, nome: "Rascunho alterado" } }));
  await waitFor(() => { expect(confirmar).not.toBeChecked(); expect(botao).toBeDisabled(); });
  fireEvent.click(confirmar);
  expect(botao).toBeEnabled();
  const chaveLista = [tipo === "calendario" ? "decisoes-impacto-ocorrencia" : "impactos-visita", usuario, cliente, plano, revision];
  const alterada = tipo === "calendario" ? { ...linha, vencimento_original: "2026-11-05" } : { ...linha, semana_origem: "2026-11-09" };
  act(() => client.setQueryData(chaveLista, { pages: [[alterada]], pageParams: [null] }));
  await waitFor(() => { expect(confirmar).not.toBeChecked(); expect(botao).toBeDisabled(); });
  expect(externo.rpc.mock.calls.filter(([nome]) => nome === "sso_decidir_impacto_mediada")).toHaveLength(0);
});

it.each(["calendario", "visita"] as const)("libera nova conferência após conflito de revisão definitivo em %s", async (tipo) => {
  vi.stubEnv("VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED", "true");
  const linha = tipo === "calendario" ? { ...comum, ciclo: 1, vencimento_original: "2026-11-04", ultimo_motivo: null } : { ...comum, semana_origem: "2026-11-02", visita_id: visita, ciclo_canonico_id: ciclo };
  const comparacao = { preparadaId: preparada, rascunhoId: rascunho, revisaoPlano: revision, tipo, rotinaLogicaId: logica, alvoOcorrenciaTipo: "sistema", alvoOcorrenciaId: alvo, vencimentoOriginal: "2026-11-04", ciclo: tipo === "calendario" ? 1 : null, visitaId: tipo === "visita" ? visita : null, semanaOrigem: tipo === "visita" ? "2026-11-02" : null, anterior: rotina, rascunho: { ...rotina, nome: "Rascunho" }, questionarioComparacao: { estado: "sem_questionario", historicoHash: null, atualHash: null }, origemOcorrencia: { versaoId: "16630000-1111-4000-8000-000000000021", numero: 1, estado: "disponivel", rotina, questionarioEstado: "sem_questionario", questionarioHash: null }, osImpacto: [], osOutroCliente: false, fontesCompletas: false, aprovacaoAutorizada: false };
  externo.rpc.mockImplementation((nome: string) => nome === "sso_decidir_impacto_comparado"
    ? Promise.resolve({ data: null, error: { code: "40001", message: "revisao_decisao_obsoleta" } })
    : { abortSignal: () => Promise.resolve({ data: nome === "sso_comparar_rotina_impacto_v3" ? comparacao : [linha], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const props = { userId: usuario, clienteId: cliente, planoId: plano, revision };
  render(<QueryClientProvider client={client}>{tipo === "calendario" ? <DecisaoImpactoOcorrencia {...props} /> : <DecisaoImpactoVisita {...props} />}</QueryClientProvider>);
  await screen.findByRole("option", { name: tipo === "calendario" ? /Ciclo 1/ : /Semana 2026-11-02/ });
  fireEvent.change(screen.getByLabelText("Ocorrência"), { target: { value: preparada } });
  await screen.findByText(/Versão anterior: Rotina original/);
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi a decisão parcial/ }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await screen.findByText(/A revisão, decisão ou comparação mudou/);
  const chave = `${tipo === "calendario" ? "sso-impacto-revisao" : "sso-impacto-visita"}:${JSON.stringify([usuario, cliente, plano])}`;
  expect(sessionStorage.getItem(chave)).toBeNull();
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).toBeNull();
  expect(screen.getByRole("button", { name: "Registrar decisão" })).toBeDisabled();
});

it.each(["calendario", "visita"] as const)("preserva tentativa anterior quando replay recebe conflito 40001 em %s", async (tipo) => {
  vi.stubEnv("VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED", "true");
  const chave = `${tipo === "calendario" ? "sso-impacto-revisao" : "sso-impacto-visita"}:${JSON.stringify([usuario, cliente, plano])}`;
  const pedido = JSON.stringify({ requestId: "16630000-1111-4000-8000-000000000098", clienteId: cliente, planoId: plano, rascunhoId: rascunho, preparadaId: preparada, planoRevision: revision, decisaoRevision: 1, decisao: "exige_reconciliacao", motivo: "Conferido" });
  sessionStorage.setItem(chave, pedido);
  externo.rpc.mockImplementation((nome: string) => nome === "sso_decidir_impacto_mediada"
    ? Promise.resolve({ data: null, error: { code: "40001", message: "revisao_decisao_obsoleta" } })
    : { abortSignal: () => Promise.resolve({ data: [], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const props = { userId: usuario, clienteId: cliente, planoId: plano, revision };
  render(<QueryClientProvider client={client}>{tipo === "calendario" ? <DecisaoImpactoOcorrencia {...props} /> : <DecisaoImpactoVisita {...props} />}</QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(chave)).toBe(pedido);
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeInTheDocument();
});


it.each(["calendario", "visita"] as const)("envia escolha explícita de alteração com comparação em %s", async (tipo) => {
  vi.stubEnv("VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_ALTERACAO_CICLO_ENABLED", "true");
  const linha = tipo === "calendario" ? { ...comum, ciclo: 1, vencimento_original: "2026-11-04", ultimo_motivo: null } : { ...comum, semana_origem: "2026-11-02", visita_id: visita, ciclo_canonico_id: ciclo };
  const comparacao = { preparadaId: preparada, rascunhoId: rascunho, revisaoPlano: revision, tipo, rotinaLogicaId: logica, alvoOcorrenciaTipo: "sistema", alvoOcorrenciaId: alvo, vencimentoOriginal: "2026-11-04", ciclo: tipo === "calendario" ? 1 : null, visitaId: tipo === "visita" ? visita : null, semanaOrigem: tipo === "visita" ? "2026-11-02" : null, anterior: rotina, rascunho: { ...rotina, nome: "Rascunho" }, questionarioComparacao: { estado: "sem_questionario", historicoHash: null, atualHash: null }, origemOcorrencia: { versaoId: "16630000-1111-4000-8000-000000000021", numero: 1, estado: "disponivel", rotina, questionarioEstado: "sem_questionario", questionarioHash: null }, osImpacto: [], osOutroCliente: false, fontesCompletas: false, aprovacaoAutorizada: false };
  externo.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => nome === "sso_escolher_alteracao_ciclo"
    ? Promise.resolve({ data: { requestId: args.p_request, preparadaId: preparada, revisaoPlano: revision, revisao: 1, decisao: "exige_reconciliacao", impactoIntegralComprovado: false, aprovacaoAutorizada: false, ocorrenciaAlterada: false, osAlteradas: false, alteracaoEscolhida: true, versaoOperacionalAplicada: false }, error: null })
    : { abortSignal: () => Promise.resolve({ data: nome === "sso_comparar_rotina_impacto_v3" ? comparacao : [linha], error: null }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const props = { userId: usuario, clienteId: cliente, planoId: plano, revision };
  render(<QueryClientProvider client={client}>{tipo === "calendario" ? <DecisaoImpactoOcorrencia {...props} /> : <DecisaoImpactoVisita {...props} />}</QueryClientProvider>);
  await screen.findByRole("option", { name: tipo === "calendario" ? /Ciclo 1/ : /Semana 2026-11-02/ });
  fireEvent.change(screen.getByLabelText("Ocorrência"), { target: { value: preparada } });
  await screen.findByText(/Versão anterior: Rotina original/);
  fireEvent.change(screen.getByLabelText("Decisão"), { target: { value: "alterar_conteudo" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi a decisão parcial/ }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar decisão" }));
  await screen.findByText(/Decisão registrada/);
  expect(externo.rpc.mock.calls.find(([nome]) => nome === "sso_escolher_alteracao_ciclo")?.[1]).toMatchObject({ p_preparada: preparada, p_tipo: tipo, p_comparacao: comparacao });
});
