// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const preparar = vi.hoisted(() => vi.fn());
const receber = vi.hoisted(() => vi.fn());
const enviarXlsx = vi.hoisted(() => vi.fn());
const reconciliarXlsx = vi.hoisted(() => vi.fn());
vi.mock("../../application/preparar-xlsx-cronograma", () => ({ prepararXlsxCronograma: preparar }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({ supabaseCapacidadesSsoAdapter: { autorizarAcao: vi.fn().mockResolvedValue(true) } }));
vi.mock("../../infrastructure/supabase-importacao-plano-adapter", () => ({ receberMatrizCronograma: receber, listarCronogramasStaging: vi.fn().mockResolvedValue([]), obterCronogramaStaging: vi.fn(), anotarRevisaoCronograma: vi.fn() }));
vi.mock("../../infrastructure/enviar-xlsx-autenticado", () => ({ enviarXlsxAutenticado: enviarXlsx, reconciliarXlsxAutenticado: reconciliarXlsx }));
import { ImportacaoPlanoWorkspace } from "./Workspace";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.clearAllMocks(); vi.mocked(supabaseCapacidadesSsoAdapter.autorizarAcao).mockResolvedValue(true); sessionStorage.clear(); });
function montar() { const query = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={query}><ImportacaoPlanoWorkspace userId="u" clienteId="c" /></QueryClientProvider>); }
const linha = (numeroLinha: number) => ({ original: { numeroLinha }, conferencia: { tempo: { estado: "tempo_a_validar" }, erros: [], semanas: [] } });

it("mantém prévia experimental oculta com chave desligada", async () => {
  montar();
  await screen.findByLabelText("Identificação da fonte");
  expect(screen.queryByLabelText("Arquivo XLSX do cronograma")).not.toBeInTheDocument();
});

it("permite prévia local ao informar fonte sem enviar arquivo ou matriz", async () => {
  vi.stubEnv("VITE_SSO_PREVIA_XLSX_ENABLED", "true");
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5), linha(6)], avisos: [] }, matriz: [["x"]], evidencias: [], sha256: "a".repeat(64) });
  montar();
  fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "Rimini" } });
  const arquivo = new File(["a"], "origem.xlsx");
  Object.defineProperty(arquivo, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo] } });
  expect(await screen.findByText(/2 linhas prontas para conferência local/)).toBeInTheDocument();
  expect(receber).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /enviar para conferência/i })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Matriz JSON da aba CRONOGRAMA")).toHaveValue("");
});

it("em desenvolvimento com flag explícita envia prévia pelo transporte XLSX sem aprovar", async () => {
  vi.stubEnv("VITE_SSO_PREVIA_XLSX_ENABLED", "true");
  vi.stubEnv("VITE_SSO_ENVIO_XLSX_DEV_ENABLED", "true");
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [["x"]], evidencias: [], sha256: "a".repeat(64) });
  enviarXlsx.mockResolvedValue({ revision: 1, created: true });
  montar(); fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "Rimini" } });
  const arquivo = new File(["a"], "origem.xlsx"); Object.defineProperty(arquivo, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo] } });
  fireEvent.click(await screen.findByRole("button", { name: /enviar para conferência/i }));
  expect(await screen.findByText(/guardado em staging/i)).toBeInTheDocument();
  expect(enviarXlsx.mock.calls[0]![0]).toEqual({ userId: "u", clienteId: "c", fonteId: "Rimini", bytes: new Uint8Array([1]) });
  expect(receber).not.toHaveBeenCalled();
});

it("não oferece envio em produção mesmo se a flag de desenvolvimento estiver ligada", async () => {
  vi.stubEnv("DEV", false); vi.stubEnv("VITE_SSO_PREVIA_XLSX_ENABLED", "true"); vi.stubEnv("VITE_SSO_ENVIO_XLSX_DEV_ENABLED", "true");
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  montar(); fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "Rimini" } });
  const arquivo = new File(["a"], "origem.xlsx"); Object.defineProperty(arquivo, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo] } });
  await screen.findByText(/linhas prontas para conferência local/i);
  expect(screen.queryByRole("button", { name: /enviar para conferência/i })).not.toBeInTheDocument();
});

it("oferece envio em build não DEV somente com a flag operacional e após escolha do usuário", async () => {
  vi.stubEnv("DEV", false); vi.stubEnv("VITE_SSO_PREVIA_XLSX_ENABLED", "true"); vi.stubEnv("VITE_SSO_ENVIO_XLSX_ENABLED", "true");
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  enviarXlsx.mockResolvedValue({ revision: 1, created: true });
  montar(); fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "Rimini" } });
  const arquivo = new File(["a"], "origem.xlsx"); Object.defineProperty(arquivo, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo] } });
  const enviar = await screen.findByRole("button", { name: /enviar para conferência/i });
  expect(enviarXlsx).not.toHaveBeenCalled();
  fireEvent.click(enviar);
  expect(await screen.findByText(/guardado em staging/i)).toBeInTheDocument();
  expect(enviarXlsx).toHaveBeenCalledTimes(1);
});

it("revalida permissão no momento do envio e bloqueia quando revogada", async () => {
  vi.stubEnv("VITE_SSO_PREVIA_XLSX_ENABLED", "true"); vi.stubEnv("VITE_SSO_ENVIO_XLSX_DEV_ENABLED", "true");
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  montar(); fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "Rimini" } });
  const arquivo = new File(["a"], "origem.xlsx"); Object.defineProperty(arquivo, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo] } });
  const botao = await screen.findByRole("button", { name: /enviar para conferência/i });
  vi.mocked(supabaseCapacidadesSsoAdapter.autorizarAcao).mockResolvedValue(false);
  fireEvent.click(botao);
  expect(await screen.findByRole("alert")).toHaveTextContent(/resultado não confirmado/i);
  expect(enviarXlsx).not.toHaveBeenCalled();
});

it("bloqueia a seleção CSV enquanto a recepção XLSX está em andamento", async () => {
  vi.stubEnv("VITE_SSO_PREVIA_XLSX_ENABLED", "true"); vi.stubEnv("VITE_SSO_ENVIO_XLSX_DEV_ENABLED", "true");
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  enviarXlsx.mockImplementation(() => new Promise(() => {}));
  montar(); fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "Rimini" } });
  const arquivo = new File(["a"], "origem.xlsx"); Object.defineProperty(arquivo, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo] } });
  fireEvent.click(await screen.findByRole("button", { name: /enviar para conferência/i }));
  expect(await screen.findByRole("button", { name: /enviando/i })).toBeDisabled();
  expect(screen.getByLabelText("Arquivo CSV do cronograma")).toBeDisabled();
});

it("permite reconciliação explícita após envio incerto sem reenviar automaticamente", async () => {
  vi.stubEnv("VITE_SSO_PREVIA_XLSX_ENABLED", "true"); vi.stubEnv("VITE_SSO_ENVIO_XLSX_DEV_ENABLED", "true");
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  enviarXlsx.mockRejectedValue(new Error("resultado incerto")); reconciliarXlsx.mockResolvedValue(undefined);
  montar(); fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "Rimini" } });
  const arquivo = new File(["a"], "origem.xlsx"); Object.defineProperty(arquivo, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo] } });
  fireEvent.click(await screen.findByRole("button", { name: /enviar para conferência/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/resultado não confirmado/i);
  fireEvent.click(screen.getByRole("button", { name: /reconciliar tentativa/i }));
  expect(await screen.findByText(/tentativa reconciliada/i)).toBeInTheDocument();
  expect(reconciliarXlsx).toHaveBeenCalledTimes(1);
  expect(enviarXlsx).toHaveBeenCalledTimes(1);
});
