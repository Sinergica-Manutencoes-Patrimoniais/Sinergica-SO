// @vitest-environment jsdom
// Contrato de interface com servidor simulado; integridade transacional é testada nos pgTAP.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ lote: "", fonte: "", matriz: [] as unknown[][], revisao: 0, planoRevisao: 1, mapeamento: false, identidade: false, classificada: false, aprovada: false, incorporada: false }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({ supabaseCapacidadesSsoAdapter: { autorizarAcao: vi.fn().mockResolvedValue(true) } }));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({ supabasePlanoManutencaoAdapter: { listarPlanos: vi.fn().mockImplementation(async () => [{ id: "plano", clienteId: "c", nome: "Plano rascunho", estado: "rascunho", revisao: estado.planoRevisao }]) } }));
vi.mock("../../infrastructure/supabase-importacao-plano-adapter", () => ({
  receberMatrizCronograma: vi.fn().mockImplementation(async (p) => { estado.lote = p.loteId; estado.fonte = p.fonteId; estado.matriz = p.matriz; estado.revisao = 1; }),
  listarCronogramasStaging: vi.fn().mockImplementation(async () => estado.lote ? [{ id: estado.lote, fonte: estado.fonte, revisao: estado.revisao, criadoEm: "2026-01-01" }] : []),
  obterCronogramaStaging: vi.fn().mockImplementation(async () => ({ fonteId: estado.fonte, revision: estado.revisao, matriz: estado.matriz })),
  listarAlvosCronograma: vi.fn().mockResolvedValue([{ id: "sistema", nome: "Sistema A" }]),
  listarMapeamentosCronograma: vi.fn().mockImplementation(async () => estado.mapeamento ? [{ id: "mapa", chave: "5", disciplina: "Elétrica", nome: "Rotina", alvoTipo: "sistema", alvoId: "sistema", modo: "calendario", revisao: 2 }] : []),
  mapearLinhaCronograma: vi.fn().mockImplementation(async (p) => { if (p.expectedRevision !== estado.revisao) throw Error("revisao_obsoleta"); estado.mapeamento = true; estado.revisao++; }),
  identificarLinhaCronograma: vi.fn().mockImplementation(async (p) => { if (p.expectedRevision !== estado.revisao) throw Error("revisao_obsoleta"); estado.identidade = true; estado.revisao++; }),
  compararIdentidadesCronograma: vi.fn().mockResolvedValue([]),
  diagnosticarCronograma: vi.fn().mockImplementation(async () => ({ revision: estado.revisao, impedimentos: [], linhasBrutas: 5, linhasClassificadas: estado.classificada ? 1 : 0, cabecalhosDeclarados: 0, dadosDeclarados: estado.classificada ? 1 : 0, ignoradasDeclaradas: 0, conferenciasConcluidas: estado.classificada ? 1 : 0, linhasComIdentidade: estado.identidade ? 1 : 0, linhasComMapeamento: estado.mapeamento ? 1 : 0, linhasRejeitadas: 0 })),
  classificarLinhaCronograma: vi.fn().mockImplementation(async (p) => { if (p.expectedRevision !== estado.revisao) throw Error("revisao_obsoleta"); estado.classificada = true; estado.revisao++; }),
  conferirLinhasCronograma: vi.fn().mockImplementation(async () => [{ chave: "5", tipo_linha: estado.classificada ? "dado" : null, conferencia: estado.classificada ? "concluida" : null, identidade: estado.identidade ? "extintor" : null, mapeamento_id: estado.mapeamento ? "mapa" : null, situacao: null, pendencias: [], alvo_atual: estado.mapeamento ? "valido" : "nao_aplicavel" }]),
  aprovarCronogramaStaging: vi.fn().mockImplementation(async (p) => { if (!estado.identidade || !estado.classificada || !estado.mapeamento || p.expectedRevision !== estado.revisao) throw Error("linha_com_pendencia"); estado.aprovada = true; estado.revisao++; }),
  prepararImportacaoCronograma: vi.fn().mockImplementation(async () => estado.aprovada ? [{ chave: "5", candidata: !estado.incorporada, identidade: "extintor", mapeamento_id: "mapa", alvo_atual: "valido", pendencias: [], revisao_lote: estado.revisao, revisao_plano: estado.planoRevisao, aprovacao_id: "aprovacao" }] : []),
  conferirToleranciasLote: vi.fn().mockResolvedValue([{ id: "mapa", antes: 0, depois: 0, configurada: false }]),
  incorporarLinhaCronograma: vi.fn().mockImplementation(async (p) => { if (!estado.aprovada || p.loteRevision !== estado.revisao || p.planoRevision !== estado.planoRevisao) throw Error("revisao_obsoleta"); estado.incorporada = true; estado.planoRevisao++; }),
}));
import { ImportacaoPlanoWorkspace } from "./Workspace";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); });
it("navega da matriz a rotina rascunho em servidor simulado", async () => {
  Object.assign(estado, { lote: "", fonte: "", matriz: [], revisao: 0, planoRevisao: 1, mapeamento: false, identidade: false, classificada: false, aprovada: false, incorporada: false });
  for (const flag of ["VITE_SSO_COMPARAR_CRONOGRAMA_ENABLED", "VITE_SSO_CLASSIFICACAO_CRONOGRAMA_ENABLED", "VITE_SSO_CONFERENCIA_INTEGRADA_CRONOGRAMA_ENABLED", "VITE_SSO_APROVAR_CRONOGRAMA_STAGING_ENABLED", "VITE_SSO_INCORPORAR_CRONOGRAMA_ENABLED", "VITE_SSO_CONFERENCIA_TOLERANCIAS_LOTE_ENABLED"]) vi.stubEnv(flag, "true");
  const cabecalho = ["CONDOMÍNIO","NATUREZA","ÁREA","ANDAR","LOCAL","SISTEMA","TIPO DE EQUIPAMENTO","EQUIPAMENTO","IDENTIFICAÇÃO","PERIODICIDADE","RESPONSÁVEL","TEMPO MÉDIO / OS (MIN)","QTD. TÉCNICOS","DURAÇÃO / OCORR. (H)","HH / OCORRÊNCIA","OCORRÊNCIAS","HH TOTAL","SITUAÇÃO","S01"];
  const matriz = [[], [], cabecalho, [...Array(18).fill(""),"2026-08-05"], ["Cliente", ...Array(17).fill(""), "X"]];
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={cache}><ImportacaoPlanoWorkspace userId="u" clienteId="c" /></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "Planilha" } });
  fireEvent.change(screen.getByLabelText("Matriz JSON da aba CRONOGRAMA"), { target: { value: JSON.stringify(matriz) } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir matriz antes de receber" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi esta matriz/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar em staging" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir linhas" }));
  expect(screen.getByRole("navigation", { name: "Etapas do cronograma selecionado" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Linha"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Disciplina"), { target: { value: "Elétrica" } });
  fireEvent.change(screen.getByLabelText("Nome da Rotina"), { target: { value: "Rotina" } });
  await within(screen.getByLabelText("Alvo existente")).findByRole("option", { name: "Sistema A" });
  fireEvent.change(screen.getByLabelText("Alvo existente"), { target: { value: "sistema" } });
  fireEvent.change(screen.getByLabelText("Data-base"), { target: { value: "2026-01-01" } });
  fireEvent.change(screen.getByLabelText("Premissa mensal da fonte"), { target: { value: "calendario_real" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar mapeamento" }));
  await waitFor(() => expect(estado.mapeamento).toBe(true));
  fireEvent.change(screen.getByLabelText("Lote"), { target: { value: estado.lote } });
  await screen.findByText(/Revisão consultada: 2/);
  fireEvent.change(screen.getByLabelText("Chave da linha de origem"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Identidade declarada"), { target: { value: "extintor" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar identidade" }));
  await waitFor(() => expect(estado.identidade).toBe(true));
  await screen.findByText(/Revisão 3:/);
  fireEvent.change(screen.getByLabelText("Chave da linha"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Conferência"), { target: { value: "concluida" } });
  fireEvent.change(within(screen.getByRole("region", { name: "Classificação e diagnóstico do cronograma" })).getByLabelText("Justificativa"), { target: { value: "Conferido" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar classificação" }));
  await waitFor(() => expect(estado.classificada).toBe(true));
  const aprovacao = screen.getByRole("region", { name: "Aprovação de lote em staging" });
  await waitFor(() => expect(within(aprovacao).getByRole("button", { name: "Solicitar aprovação de staging" })).toBeEnabled());
  fireEvent.change(within(aprovacao).getByLabelText("Justificativa"), { target: { value: "Conferido" } });
  fireEvent.click(within(aprovacao).getByRole("button", { name: "Solicitar aprovação de staging" }));
  await waitFor(() => expect(estado.aprovada).toBe(true));
  await within(screen.getByLabelText("Plano rascunho")).findByRole("option", { name: /Plano rascunho/ });
  fireEvent.change(screen.getByLabelText("Plano rascunho"), { target: { value: "plano" } });
  fireEvent.click(await screen.findByRole("button", { name: "Conferir linha" }));
  fireEvent.click(await screen.findByLabelText("Conferi os dados e tolerâncias desta linha."));
  fireEvent.click(await screen.findByRole("button", { name: "Criar Rotina rascunho" }));
  await waitFor(() => expect(estado.incorporada).toBe(true));
  expect(await screen.findByText(/Rotina criada em rascunho; nenhuma ocorrência ou OS foi gerada/)).toBeInTheDocument();
});
