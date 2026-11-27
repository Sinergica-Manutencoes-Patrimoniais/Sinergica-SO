// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelatorioClientePage } from "./RelatorioClientePage";

const mocks = vi.hoisted(() => ({
  listarOrdensServico: vi.fn(async () => []),
  listarInspecoes: vi.fn(),
  publicar: vi.fn(async () => undefined),
}));

vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "usuario" } }) }));
vi.mock("../../../config/flags-sso", () => ({ flagLigada: () => false }));
vi.mock("../interfaces/despesas-visita/RelatorioClienteDespesas", () => ({
  RelatorioClienteDespesas: () => null,
}));
vi.mock("../infrastructure/supabase-cliente-360-adapter", () => ({
  supabaseCliente360Adapter: {
    listarClientes: async () => [
      { id: "a", nome: "Condominio Alfa", ativo: true },
      { id: "b", nome: "Condominio Beta", ativo: true },
    ],
  },
}));
vi.mock("../infrastructure/supabase-hub-os-adapter", () => ({ supabaseHubOsAdapter: mocks }));
vi.mock("../infrastructure/supabase-agenda-tecnico-adapter", () => ({
  supabaseAgendaTecnicoAdapter: { listarSemana: async () => [] },
}));
vi.mock("../infrastructure/supabase-pmoc-adapter", () => ({
  supabasePmocAdapter: { listarProximasPreventivas: async () => [] },
}));
vi.mock("../infrastructure/supabase-qualidade-adapter", () => ({
  supabaseQualidadeAdapter: mocks,
}));
vi.mock("../infrastructure/supabase-relatorio-cliente-adapter", () => ({
  supabaseRelatorioClienteAdapter: mocks,
}));

const inspecoes = [
  {
    id: "1",
    clientId: "a",
    titulo: "Inspecao antiga",
    dataInspecao: "2026-11-18",
    status: "concluida",
  },
  {
    id: "2",
    clientId: "a",
    titulo: "Inspecao recente",
    dataInspecao: "2026-11-25",
    status: "concluida",
  },
  {
    id: "3",
    clientId: "a",
    titulo: "Inspecao aberta",
    dataInspecao: "2026-11-19",
    status: "em_andamento",
  },
  {
    id: "4",
    clientId: "b",
    titulo: "Inspecao Beta",
    dataInspecao: "2026-11-18",
    status: "concluida",
  },
];

function alterar(rotulo: string, value: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value } });
}

function botao(nome: string) {
  return screen.getByRole("button", { name: nome });
}

async function abrir() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RelatorioClientePage />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: "Condominio Alfa" });
  alterar("Cliente", "a");
  alterar("Início", "2026-11-01");
  alterar("Fim", "2026-11-26");
}

async function textoPdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const conteudo = pdf.getPage(0).node.Contents();
  if (!(conteudo instanceof PDFArray)) throw new Error("Página sem conteúdo");
  return Array.from({ length: conteudo.size() }, (_, index) => {
    const stream = pdf.context.lookup(conteudo.get(index));
    if (!(stream instanceof PDFRawStream)) throw new Error("Fluxo PDF inválido");
    const comandos = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    return Array.from(comandos.matchAll(/<([0-9A-F]+)> Tj/g), ([, hex = ""]) =>
      Buffer.from(hex, "hex").toString("latin1"),
    ).join("\n");
  }).join("\n");
}

function capturarPdf() {
  let bytes: Uint8Array | undefined;
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      const reader = new FileReader();
      reader.onload = () => {
        bytes = new Uint8Array(reader.result as ArrayBuffer);
      };
      reader.readAsArrayBuffer(blob);
      return "blob:teste";
    },
    revokeObjectURL: vi.fn(),
  });
  const downloads: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  return {
    downloads,
    async texto() {
      await waitFor(() => expect(bytes).toBeDefined());
      return textoPdf(bytes as Uint8Array);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listarInspecoes.mockResolvedValue(inspecoes);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Relatório do Cliente", () => {
  it("invalida o período anterior e baixa o PDF do novo recorte com nome e conteúdo coerentes", async () => {
    const pdf = capturarPdf();
    await abrir();
    fireEvent.click(botao("Gerar relatório"));
    await screen.findByText(/Inspecao recente/);

    alterar("Fim", "2026-11-20");
    expect(screen.queryByRole("article")).toBeNull();
    expect(botao("Exportar PDF")).toBeDisabled();
    expect(botao("Publicar no Portal")).toBeDisabled();
    fireEvent.click(botao("Gerar relatório"));
    await screen.findByText(/Inspecao antiga/);
    expect(screen.queryByText(/Inspecao recente/)).toBeNull();

    fireEvent.click(botao("Exportar PDF"));
    const texto = await pdf.texto();
    expect(pdf.downloads).toEqual(["relatorio-condominio-alfa-2026-11-20.pdf"]);
    expect(texto).toContain("2026-11-01 a 2026-11-20");
    expect(texto).toContain("Inspecao antiga");
    expect(texto).not.toContain("Inspecao recente");

    alterar("Cliente", "b");
    expect(screen.queryByRole("article")).toBeNull();
    expect(botao("Publicar no Portal")).toBeDisabled();
  });

  it("apresenta só inspeções concluídas como trabalho realizado na tela e no PDF", async () => {
    const pdf = capturarPdf();
    await abrir();
    fireEvent.click(botao("Gerar relatório"));
    await screen.findByText(/Inspecao antiga/);
    expect(screen.queryByText(/Inspecao aberta/)).toBeNull();
    expect(screen.queryByText(/Inspecao Beta/)).toBeNull();
    fireEvent.click(botao("Exportar PDF"));
    const texto = await pdf.texto();
    expect(texto).toContain("Inspecao antiga");
    expect(texto).toContain("Inspecao recente");
    expect(texto).not.toContain("Inspecao aberta");
    expect(texto).not.toContain("Inspecao Beta");
    expect(texto).toContain("2 atendimento(s) realizado(s)");
  });

  it("descarta a resposta de uma geração se os filtros mudarem durante a consulta", async () => {
    let concluir!: (resultado: typeof inspecoes) => void;
    mocks.listarInspecoes.mockReturnValueOnce(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    );
    await abrir();
    fireEvent.click(botao("Gerar relatório"));
    await waitFor(() => expect(mocks.listarInspecoes).toHaveBeenCalledOnce());
    alterar("Fim", "2026-11-20");
    await act(async () => concluir(inspecoes));
    expect(screen.queryByRole("article")).toBeNull();
    expect(botao("Exportar PDF")).toBeDisabled();
    expect(botao("Publicar no Portal")).toBeDisabled();
  });

  it("bloqueia período invertido ou incompleto antes de consultar", async () => {
    await abrir();
    alterar("Início", "2026-11-25");
    alterar("Fim", "2026-11-20");
    expect(botao("Gerar relatório")).toBeDisabled();
    expect(botao("Exportar PDF")).toBeDisabled();
    expect(botao("Publicar no Portal")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/período/i);
    alterar("Início", "");
    expect(botao("Gerar relatório")).toBeDisabled();
    expect(mocks.listarOrdensServico).not.toHaveBeenCalled();
  });
});
