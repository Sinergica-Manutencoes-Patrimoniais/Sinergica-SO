// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

const chamadas = vi.hoisted(() => ({ receber: vi.fn(), listar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: vi.fn().mockResolvedValue(true) },
}));
vi.mock("../../infrastructure/supabase-importacao-plano-adapter", () => ({
  receberMatrizCronograma: chamadas.receber,
  listarCronogramasStaging: chamadas.listar,
  obterCronogramaStaging: vi.fn(),
  anotarRevisaoCronograma: vi.fn(),
}));
import { ImportacaoPlanoWorkspace } from "./Workspace";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});
it("prepara CSV como texto localmente e não grava antes da ação de staging", async () => {
  chamadas.listar.mockResolvedValue([]);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={query}>
      <ImportacaoPlanoWorkspace userId="u" clienteId="c" />
    </QueryClientProvider>,
  );
  const input = await screen.findByLabelText("Arquivo CSV do cronograma");
  const arquivo = new File(["Código;Nome\r\n001;VRF"], "cronograma.csv", { type: "text/csv" });
  Object.defineProperty(arquivo, "arrayBuffer", {
    value: async () => new TextEncoder().encode("Código;Nome\r\n001;VRF").buffer,
  });
  fireEvent.change(input, { target: { files: [arquivo] } });
  fireEvent.click(await screen.findByRole("button", { name: "Usar CSV na matriz de conferência" }));
  expect(screen.getByLabelText("Matriz JSON da aba CRONOGRAMA")).toHaveValue(
    JSON.stringify([
      ["Código", "Nome"],
      ["001", "VRF"],
    ]),
  );
  expect(chamadas.receber).not.toHaveBeenCalled();
});

it("permite selecionar novamente o mesmo CSV depois de usá-lo", async () => {
  chamadas.listar.mockResolvedValue([]);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const usuario = userEvent.setup();
  render(<QueryClientProvider client={query}><ImportacaoPlanoWorkspace userId="u" clienteId="c" /></QueryClientProvider>);
  const input = await screen.findByLabelText("Arquivo CSV do cronograma") as HTMLInputElement;
  const arquivo = new File(["Código;Nome"], "cronograma.csv", { type: "text/csv" });
  Object.defineProperty(arquivo, "arrayBuffer", { value: async () => new TextEncoder().encode("Código;Nome").buffer });
  await usuario.upload(input, arquivo);
  await usuario.click(await screen.findByRole("button", { name: "Usar CSV na matriz de conferência" }));
  expect(input.files).toHaveLength(0);
  await usuario.upload(input, arquivo);
  expect(await screen.findByRole("button", { name: "Usar CSV na matriz de conferência" })).toBeInTheDocument();
  expect(chamadas.receber).not.toHaveBeenCalled();
});

it("não permite guardar matriz anterior enquanto novo CSV é lido ou aguarda uso", async () => {
  chamadas.listar.mockResolvedValue([]);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={query}>
      <ImportacaoPlanoWorkspace userId="u" clienteId="c" />
    </QueryClientProvider>,
  );
  const input = await screen.findByLabelText("Arquivo CSV do cronograma");
  const arquivo = new File(["Código;Nome"], "novo.csv", { type: "text/csv" });
  let resolver!: (dados: ArrayBuffer) => void;
  Object.defineProperty(arquivo, "arrayBuffer", {
    value: () =>
      new Promise<ArrayBuffer>((resolve) => {
        resolver = resolve;
      }),
  });
  fireEvent.change(input, { target: { files: [arquivo] } });
  expect(screen.getByRole("button", { name: "Guardar em staging" })).toBeDisabled();
  resolver(new TextEncoder().encode("Código;Nome").buffer);
  const usar = await screen.findByRole("button", { name: "Usar CSV na matriz de conferência" });
  expect(screen.getByRole("button", { name: "Guardar em staging" })).toBeDisabled();
  fireEvent.click(usar);
  expect(screen.getByRole("button", { name: "Guardar em staging" })).toBeDisabled();
  expect(chamadas.receber).not.toHaveBeenCalled();
});

it("mantém envio bloqueado após CSV inválido até a seleção ser descartada", async () => {
  chamadas.listar.mockResolvedValue([]);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={query}>
      <ImportacaoPlanoWorkspace userId="u" clienteId="c" />
    </QueryClientProvider>,
  );
  const input = await screen.findByLabelText("Arquivo CSV do cronograma");
  const arquivo = new File(["x"], "novo.xlsx");
  fireEvent.change(input, { target: { files: [arquivo] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("CSV inválido");
  expect(screen.getByRole("button", { name: "Guardar em staging" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Descartar seleção CSV" }));
  expect(screen.getByRole("button", { name: "Guardar em staging" })).toBeDisabled();
  expect(chamadas.receber).not.toHaveBeenCalled();
});

it("ignora conclusão tardia de CSV descartado", async () => {
  chamadas.listar.mockResolvedValue([]);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={query}>
      <ImportacaoPlanoWorkspace userId="u" clienteId="c" />
    </QueryClientProvider>,
  );
  const input = await screen.findByLabelText("Arquivo CSV do cronograma");
  const arquivo = new File(["x"], "novo.csv");
  let resolver!: (dados: ArrayBuffer) => void;
  Object.defineProperty(arquivo, "arrayBuffer", {
    value: () =>
      new Promise<ArrayBuffer>((resolve) => {
        resolver = resolve;
      }),
  });
  fireEvent.change(input, { target: { files: [arquivo] } });
  fireEvent.click(screen.getByRole("button", { name: "Descartar seleção CSV" }));
  await act(async () => {
    resolver(new TextEncoder().encode("Código;Nome").buffer);
  });
  expect(
    screen.queryByRole("button", { name: "Usar CSV na matriz de conferência" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar em staging" })).toBeDisabled();
});

it("atualiza lotes confirmados mesmo se não conseguir limpar a tentativa local", async () => {
  chamadas.listar.mockResolvedValueOnce([]).mockResolvedValue([{ id: "novo", fonte: "fonte nova", revisao: 1 }]);
  chamadas.receber.mockResolvedValue({});
  const limpar = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("storage indisponível"); });
  try {
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={query}><ImportacaoPlanoWorkspace userId="u" clienteId="c" /></QueryClientProvider>);
    const matriz = [[], [], ["CONDOMÍNIO", "NATUREZA", "ÁREA", "ANDAR", "LOCAL", "SISTEMA", "TIPO DE EQUIPAMENTO", "EQUIPAMENTO", "IDENTIFICAÇÃO", "PERIODICIDADE", "RESPONSÁVEL", "TEMPO MÉDIO / OS (MIN)", "QTD. TÉCNICOS", "DURAÇÃO / OCORR. (H)", "HH / OCORRÊNCIA", "OCORRÊNCIAS", "HH TOTAL", "SITUAÇÃO", "S01"], Array(18).fill("").concat(["2026-08-05"]), ["Cliente"]];
    fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "fonte nova" } });
    fireEvent.change(screen.getByLabelText("Matriz JSON da aba CRONOGRAMA"), { target: { value: JSON.stringify(matriz) } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir matriz antes de receber" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi esta matriz/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar em staging" }));
    expect(await screen.findByText(/tentativa local não pôde ser removida/)).toBeInTheDocument();
    expect(await screen.findByText(/fonte nova · revisão 1/)).toBeInTheDocument();
  } finally {
    limpar.mockRestore();
  }
});

it("não sobrescreve tentativa criada por outra instância antes do envio", async () => {
  chamadas.listar.mockResolvedValue([]);
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><ImportacaoPlanoWorkspace userId="u" clienteId="c" /></QueryClientProvider>);
  const matriz = [[], [], ["CONDOMÍNIO", "NATUREZA", "ÁREA", "ANDAR", "LOCAL", "SISTEMA", "TIPO DE EQUIPAMENTO", "EQUIPAMENTO", "IDENTIFICAÇÃO", "PERIODICIDADE", "RESPONSÁVEL", "TEMPO MÉDIO / OS (MIN)", "QTD. TÉCNICOS", "DURAÇÃO / OCORR. (H)", "HH / OCORRÊNCIA", "OCORRÊNCIAS", "HH TOTAL", "SITUAÇÃO", "S01"], Array(18).fill("").concat(["2026-08-05"]), ["Cliente"]];
  fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "fonte nova" } });
  fireEvent.change(screen.getByLabelText("Matriz JSON da aba CRONOGRAMA"), { target: { value: JSON.stringify(matriz) } });
  const chave = `sso-cronograma:${JSON.stringify(["u", "c"])}`;
  const anterior = JSON.stringify({ tipo: "recepcao", pedido: { requestId: "anterior", loteId: "lote", clienteId: "c", matriz: [] } });
  sessionStorage.setItem(chave, anterior);
  fireEvent.click(screen.getByRole("button", { name: "Conferir matriz antes de receber" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi esta matriz/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar em staging" }));
  expect(sessionStorage.getItem(chave)).toBe(anterior);
  expect(chamadas.receber).not.toHaveBeenCalled();
  expect(await screen.findByRole("status")).toHaveTextContent(/tentativa anterior/i);
});

it("não apaga tentativa diferente criada durante o envio", async () => {
  chamadas.listar.mockResolvedValue([]);
  let resolver!: (valor: object) => void;
  chamadas.receber.mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={query}><ImportacaoPlanoWorkspace userId="u" clienteId="c" /></QueryClientProvider>);
  const matriz = [[], [], ["CONDOMÍNIO", "NATUREZA", "ÁREA", "ANDAR", "LOCAL", "SISTEMA", "TIPO DE EQUIPAMENTO", "EQUIPAMENTO", "IDENTIFICAÇÃO", "PERIODICIDADE", "RESPONSÁVEL", "TEMPO MÉDIO / OS (MIN)", "QTD. TÉCNICOS", "DURAÇÃO / OCORR. (H)", "HH / OCORRÊNCIA", "OCORRÊNCIAS", "HH TOTAL", "SITUAÇÃO", "S01"], Array(18).fill("").concat(["2026-08-05"]), ["Cliente"]];
  fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "fonte nova" } });
  fireEvent.change(screen.getByLabelText("Matriz JSON da aba CRONOGRAMA"), { target: { value: JSON.stringify(matriz) } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir matriz antes de receber" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi esta matriz/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar em staging" }));
  await screen.findByText(/tentativa pendente/i);
  const chave = `sso-cronograma:${JSON.stringify(["u", "c"])}`;
  const outra = JSON.stringify({ tipo: "revisao", pedido: { requestId: "outro", loteId: "lote", expectedRevision: 1, numeroLinha: 5, observacao: "conferir" } });
  sessionStorage.setItem(chave, outra);
  await act(async () => resolver({}));
  expect(sessionStorage.getItem(chave)).toBe(outra);
});

it("não repete pedido antigo quando a tentativa guardada mudou", async () => {
  chamadas.listar.mockResolvedValue([]);
  chamadas.receber.mockRejectedValue(new Error("resposta incerta"));
  const query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={query}><ImportacaoPlanoWorkspace userId="u" clienteId="c" /></QueryClientProvider>);
  const matriz = [[], [], ["CONDOMÍNIO", "NATUREZA", "ÁREA", "ANDAR", "LOCAL", "SISTEMA", "TIPO DE EQUIPAMENTO", "EQUIPAMENTO", "IDENTIFICAÇÃO", "PERIODICIDADE", "RESPONSÁVEL", "TEMPO MÉDIO / OS (MIN)", "QTD. TÉCNICOS", "DURAÇÃO / OCORR. (H)", "HH / OCORRÊNCIA", "OCORRÊNCIAS", "HH TOTAL", "SITUAÇÃO", "S01"], Array(18).fill("").concat(["2026-08-05"]), ["Cliente"]];
  fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "fonte nova" } });
  fireEvent.change(screen.getByLabelText("Matriz JSON da aba CRONOGRAMA"), { target: { value: JSON.stringify(matriz) } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir matriz antes de receber" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi esta matriz/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar em staging" }));
  expect(await screen.findByRole("status")).toHaveTextContent(/resultado não confirmado/i);
  const chave = `sso-cronograma:${JSON.stringify(["u", "c"])}`;
  const outra = JSON.stringify({ tipo: "revisao", pedido: { requestId: "outro", loteId: "lote", expectedRevision: 1, numeroLinha: 5, observacao: "conferir" } });
  sessionStorage.setItem(chave, outra);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  expect(chamadas.receber).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(chave)).toBe(outra);
  expect(await screen.findByRole("status")).toHaveTextContent(/tentativa.*alterada/i);
});

it("repete o mesmo pedido quando a tentativa guardada permanece idêntica", async () => {
  chamadas.listar.mockResolvedValue([]);
  chamadas.receber.mockRejectedValue(new Error("resposta incerta"));
  const query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={query}><ImportacaoPlanoWorkspace userId="u" clienteId="c" /></QueryClientProvider>);
  const matriz = [[], [], ["CONDOMÍNIO", "NATUREZA", "ÁREA", "ANDAR", "LOCAL", "SISTEMA", "TIPO DE EQUIPAMENTO", "EQUIPAMENTO", "IDENTIFICAÇÃO", "PERIODICIDADE", "RESPONSÁVEL", "TEMPO MÉDIO / OS (MIN)", "QTD. TÉCNICOS", "DURAÇÃO / OCORR. (H)", "HH / OCORRÊNCIA", "OCORRÊNCIAS", "HH TOTAL", "SITUAÇÃO", "S01"], Array(18).fill("").concat(["2026-08-05"]), ["Cliente"]];
  fireEvent.change(await screen.findByLabelText("Identificação da fonte"), { target: { value: "fonte nova" } });
  fireEvent.change(screen.getByLabelText("Matriz JSON da aba CRONOGRAMA"), { target: { value: JSON.stringify(matriz) } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir matriz antes de receber" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi esta matriz/ }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar em staging" }));
  expect(await screen.findByRole("status")).toHaveTextContent(/resultado não confirmado/i);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
  await act(async () => {});
  expect(chamadas.receber).toHaveBeenCalledTimes(2);
  expect(chamadas.receber.mock.calls[1]?.[0]).toEqual(chamadas.receber.mock.calls[0]?.[0]);
});
