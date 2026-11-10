// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const preparar = vi.hoisted(() => vi.fn());
vi.mock("../../application/preparar-xlsx-cronograma", () => ({ prepararXlsxCronograma: preparar }));
import { PreviaXlsx } from "./PreviaXlsx";

afterEach(() => { cleanup(); preparar.mockReset(); });
const arquivo = (nome: string) => {
  const f = new File(["a"], nome);
  Object.defineProperty(f, "arrayBuffer", { value: async () => new Uint8Array([1]).buffer });
  return f;
};
const linha = (numeroLinha: number) => ({ original: { numeroLinha }, conferencia: { tempo: { estado: "tempo_a_validar" }, erros: [], semanas: [] } });

it("mostra linhas e avisos sem oferecer envio", async () => {
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5), linha(6)], avisos: [{ referencia: "M5", motivo: "formula" }] }, matriz: [["x"]], evidencias: [], sha256: "a".repeat(64) });
  render(<PreviaXlsx fonteId="fonte" clienteId="cliente" />);
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.xlsx")] } });
  expect(await screen.findByText(/2 linhas/i)).toBeInTheDocument();
  expect(screen.getByText(/M5.*fórmula/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /enviar|guardar|aprovar/i })).not.toBeInTheDocument();
});

it("descarta resultado que chega depois de cancelar a leitura", async () => {
  let resolver!: (value: unknown) => void;
  preparar.mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
  render(<PreviaXlsx fonteId="fonte" clienteId="cliente" />);
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.xlsx")] } });
  await screen.findByText(/lendo/i);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
  await act(async () => resolver({ previa: { estado: "conferivel", linhas: [linha(5), linha(6)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) }));
  expect(screen.queryByText(/2 linhas/i)).not.toBeInTheDocument();
});

it("rejeita extensão incorreta e não inicia preparação", async () => {
  render(<PreviaXlsx fonteId="fonte" clienteId="cliente" />);
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.csv")] } });
  expect(await screen.findByRole("alert")).toHaveTextContent(/inválido/i);
  expect(preparar).not.toHaveBeenCalled();
});

it("ao trocar Cliente, descarta a resposta pendente do contexto anterior", async () => {
  let resolver!: (value: unknown) => void;
  preparar.mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
  const tela = render(<PreviaXlsx fonteId="fonte" clienteId="cliente-a" />);
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.xlsx")] } });
  await act(async () => { await Promise.resolve(); });
  tela.rerender(<PreviaXlsx fonteId="fonte" clienteId="cliente-b" />);
  await act(async () => resolver({ previa: { estado: "conferivel", linhas: [linha(5), linha(6)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) }));
  expect(screen.queryByText(/2 linhas/i)).not.toBeInTheDocument();
});

it("apresenta bloqueios de campos necessários sem declarar a prévia pronta", async () => {
  preparar.mockResolvedValue({ previa: { estado: "pendente", pendencias: [{ referencia: "I5", motivo: "formula" }] }, matriz: null, evidencias: [], sha256: "a".repeat(64) });
  render(<PreviaXlsx fonteId="fonte" clienteId="cliente" />);
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.xlsx")] } });
  expect(await screen.findByText(/I5.*fórmula/i)).toBeInTheDocument();
  expect(screen.queryByText(/linhas prontas/i)).not.toBeInTheDocument();
});

it("permite selecionar o mesmo arquivo após trocar de Cliente", async () => {
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5), linha(6)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  const usuario = userEvent.setup();
  const tela = render(<PreviaXlsx fonteId="fonte" clienteId="cliente-a" />);
  const entrada = screen.getByLabelText("Arquivo XLSX do cronograma") as HTMLInputElement;
  const documento = arquivo("origem.xlsx");
  await usuario.upload(entrada, documento);
  await screen.findByText(/2 linhas/i);
  tela.rerender(<PreviaXlsx fonteId="fonte" clienteId="cliente-b" />);
  expect(entrada.files).toHaveLength(0);
  await usuario.upload(entrada, documento);
  await screen.findByText(/2 linhas/i);
  expect(preparar).toHaveBeenCalledTimes(2);
});

it("oferece envio experimental somente depois da prévia conferível", async () => {
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [["x"]], evidencias: [], sha256: "a".repeat(64) });
  const enviar = vi.fn().mockResolvedValue(undefined);
  render(<PreviaXlsx fonteId="fonte" clienteId="cliente" enviarExperimental={enviar} />);
  expect(screen.queryByRole("button", { name: /enviar para conferência/i })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.xlsx")] } });
  fireEvent.click(await screen.findByRole("button", { name: /enviar para conferência/i }));
  expect(await screen.findByText(/guardado em staging/i)).toBeInTheDocument();
  expect(enviar).toHaveBeenCalledWith(new Uint8Array([1]));
});

it("mantém a seleção para repetição quando o envio tem resultado incerto", async () => {
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  const enviar = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(undefined);
  render(<PreviaXlsx fonteId="fonte" clienteId="cliente" enviarExperimental={enviar} />);
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.xlsx")] } });
  fireEvent.click(await screen.findByRole("button", { name: /enviar para conferência/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/resultado não confirmado/i);
  fireEvent.click(screen.getByRole("button", { name: /repetir envio/i }));
  expect(await screen.findByText(/guardado em staging/i)).toBeInTheDocument();
  expect(enviar).toHaveBeenCalledTimes(2);
});

it("bloqueia edição e duplo envio enquanto aguarda confirmação", async () => {
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  let terminar!: () => void;
  const enviar = vi.fn(() => new Promise<void>((resolve) => { terminar = resolve; }));
  render(<PreviaXlsx fonteId="fonte" clienteId="cliente" enviarExperimental={enviar} />);
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.xlsx")] } });
  const botao = await screen.findByRole("button", { name: /enviar para conferência/i });
  fireEvent.click(botao); fireEvent.click(botao);
  expect(screen.getByLabelText("Arquivo XLSX do cronograma")).toBeDisabled();
  expect(screen.getByRole("button", { name: /descartar/i })).toBeDisabled();
  expect(enviar).toHaveBeenCalledTimes(1);
  await act(async () => terminar());
});

it("não mostra confirmação antiga depois da troca de Cliente", async () => {
  preparar.mockResolvedValue({ previa: { estado: "conferivel", linhas: [linha(5)], avisos: [] }, matriz: [], evidencias: [], sha256: "a".repeat(64) });
  let terminar!: () => void;
  const enviar = vi.fn(() => new Promise<void>((resolve) => { terminar = resolve; }));
  const tela = render(<PreviaXlsx fonteId="fonte" clienteId="a" enviarExperimental={enviar} />);
  fireEvent.change(screen.getByLabelText("Arquivo XLSX do cronograma"), { target: { files: [arquivo("origem.xlsx")] } });
  fireEvent.click(await screen.findByRole("button", { name: /enviar para conferência/i }));
  tela.rerender(<PreviaXlsx fonteId="fonte" clienteId="b" enviarExperimental={enviar} />);
  await act(async () => terminar());
  expect(screen.queryByText(/guardado em staging/i)).not.toBeInTheDocument();
});
