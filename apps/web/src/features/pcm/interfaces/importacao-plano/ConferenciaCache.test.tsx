// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ conferir: vi.fn(), classificar: vi.fn(), mapear: vi.fn(), revisar: vi.fn(), tolerancia: vi.fn(), diagnosticar: vi.fn(), alvos: vi.fn(), mapeamentos: vi.fn(), historico: vi.fn(), obter: vi.fn(), identificar: vi.fn(), lote: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-importacao-plano-adapter", () => ({
  conferirLinhasCronograma: api.conferir,
  classificarLinhaCronograma: api.classificar,
  mapearLinhaCronograma: api.mapear,
  revisarLinhaCronograma: api.revisar,
  salvarToleranciaCronograma: api.tolerancia,
  diagnosticarCronograma: api.diagnosticar,
  listarAlvosCronograma: api.alvos,
  listarMapeamentosCronograma: api.mapeamentos,
  listarRevisoesLinhaCronograma: api.historico,
  obterToleranciaCronograma: api.obter,
  identificarLinhaCronograma: api.identificar,
  obterCronogramaStaging: api.lote,
  compararIdentidadesCronograma: vi.fn(),
}));
import { ClassificacaoLinha } from "./ClassificacaoLinha";
import { ConferenciaIntegrada } from "./ConferenciaIntegrada";
import { MapeamentoLinha } from "./MapeamentoLinha";
import { RevisaoLinha } from "./RevisaoLinha";
import { ToleranciaLinha } from "./ToleranciaLinha";
import { CompararLotes } from "./CompararLotes";

const props = { userId: "u", clienteId: "c", loteId: "l" };
const chave = ["conferencia-integrada-cronograma", "u", "c", "l"];
const linha = (identidade: string) => ({ chave: "1", tipo_linha: "dado", conferencia: "concluida", identidade, mapeamento_id: null, situacao: null, pendencias: [], alvo_atual: "nao_aplicavel" });
beforeEach(() => {
  api.diagnosticar.mockResolvedValue({ revision: 1, impedimentos: [], linhasBrutas: 1, linhasClassificadas: 0, cabecalhosDeclarados: 0, dadosDeclarados: 0, ignoradasDeclaradas: 0, conferenciasConcluidas: 0, linhasComIdentidade: 0, linhasComMapeamento: 0, linhasRejeitadas: 0 });
  api.alvos.mockResolvedValue([{ id: "alvo", nome: "Sistema" }]); api.mapeamentos.mockResolvedValue([]); api.historico.mockResolvedValue([]); api.obter.mockResolvedValue({ antes: 0, depois: 0, configurada: false });
  api.identificar.mockResolvedValue({}); api.lote.mockResolvedValue({ revision: 1, fonteId: "fonte", matriz: [] });
});

it("identidade declarada invalida a conferência do lote correto mesmo sem limpeza", async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(chave, { pages: [[linha("ANTIGA")]], pageParams: [null] });
  render(<QueryClientProvider client={cache}><CompararLotes {...props} lotes={[{ id: "l", fonte: "Fonte", revisao: 1 }]} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Lote"), { target: { value: "l" } });
  await screen.findByText(/Revisão consultada: 1/);
  fireEvent.change(screen.getByLabelText("Chave da linha de origem"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Identidade declarada"), { target: { value: "nova" } });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("indisponível"); });
  fireEvent.click(screen.getByRole("button", { name: "Guardar identidade" }));
  await waitFor(() => expect(cache.getQueryState(chave)?.isInvalidated).toBe(true));
  expect(await screen.findByText(/não foi possível limpar a tentativa local/)).toBeInTheDocument();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); sessionStorage.clear(); });

it("oculta conferência antiga durante atualização mesmo se limpar tentativa falhar", async () => {
  let concluir!: (valor: ReturnType<typeof linha>[]) => void;
  api.conferir.mockResolvedValueOnce([linha("ANTIGA")]).mockImplementationOnce(() => new Promise((resolve) => { concluir = resolve; }));
  api.classificar.mockResolvedValue({});
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><ConferenciaIntegrada {...props} /><ClassificacaoLinha {...props} /></QueryClientProvider>);
  expect(await screen.findByText(/identidade ANTIGA/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Chave da linha"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Justificativa"), { target: { value: "Conferido" } });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("indisponível"); });
  fireEvent.click(screen.getByRole("button", { name: "Registrar classificação" }));
  await waitFor(() => expect(api.conferir).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(/identidade ANTIGA/)).not.toBeInTheDocument();
  concluir([linha("NOVA")]);
  expect(await screen.findByText(/identidade NOVA/)).toBeInTheDocument();
  expect(await screen.findByText(/Não foi possível limpar a tentativa local/)).toBeInTheDocument();
});

it.each(["mapeamento", "revisao", "tolerancia"] as const)("invalida conferência após %s, mesmo sem limpeza local", async (operacao) => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(chave, { pages: [[linha("ANTIGA")]], pageParams: [null] });
  api.mapear.mockResolvedValue({}); api.revisar.mockResolvedValue({}); api.tolerancia.mockResolvedValue({});
  const tela = operacao === "mapeamento" ? <MapeamentoLinha {...props} revisao={1} /> : operacao === "revisao" ? <RevisaoLinha {...props} revisao={1} /> : <ToleranciaLinha {...props} revisao={1} chave="1" mapeamentoId="m" />;
  render(<QueryClientProvider client={cache}>{tela}</QueryClientProvider>);
  if (operacao === "mapeamento") {
    fireEvent.change(screen.getByLabelText("Linha"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Disciplina"), { target: { value: "Elétrica" } });
    fireEvent.change(screen.getByLabelText("Nome da Rotina"), { target: { value: "Rotina" } });
    await within(screen.getByLabelText("Alvo existente")).findByRole("option", { name: "Sistema" });
    fireEvent.change(screen.getByLabelText("Alvo existente"), { target: { value: "alvo" } });
    fireEvent.change(screen.getByLabelText("Data-base"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Premissa mensal da fonte"), { target: { value: "nao_aplicavel" } });
  } else if (operacao === "revisao") {
    fireEvent.change(screen.getByLabelText("Chave da linha"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Revisar" } });
  } else await screen.findByText(/Atual:/);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("indisponível"); });
  fireEvent.click(screen.getByRole("button", { name: operacao === "mapeamento" ? "Guardar mapeamento" : operacao === "revisao" ? "Registrar na revisão 1" : "Guardar tolerância" }));
  await waitFor(() => expect(cache.getQueryState(chave)?.isInvalidated).toBe(true));
  expect(await screen.findByText(/não foi possível limpar|não pôde ser removida/i)).toBeInTheDocument();
});
