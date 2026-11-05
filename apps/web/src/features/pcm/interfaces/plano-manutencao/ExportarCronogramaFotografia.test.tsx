import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import { act, fireEvent, render as renderOriginal, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ preparar: vi.fn(), feriados: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "user-a" } }, error: null }) } },
}));
vi.mock("../../infrastructure/exportacao-cronograma-autenticada", () => ({
  prepararCronogramaAutenticado: api.preparar,
}));
vi.mock("../../infrastructure/feriados-cronograma", () => ({
  consultarFeriadosCronograma: api.feriados,
}));
vi.mock("../../infrastructure/supabase-calendario-contratual-adapter", () => ({
  supabaseCalendarioContratualAdapter: { listarContratos: async () => [] },
}));
vi.mock("./SelecionarAlvoCronograma", () => ({
  SelecionarAlvoCronograma: ({
    onSelecionar,
  }: { onSelecionar: (tipo: "sistema", id: string, hash: string) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSelecionar("sistema", "00000000-0000-4000-8000-000000000001", "fotografia-antiga")
      }
    >
      Escolher sistema
    </button>
  ),
}));
import { ExportarCronogramaFotografia } from "./ExportarCronogramaFotografia";

const props = {
  userId: "user-a",
  clienteId: "cliente-a",
  planoId: "plano-a",
  versaoId: "versao-a",
};
function render(elemento: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderOriginal(elemento, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  api.preparar.mockReset();
  api.feriados.mockReset();
});
function preencherDatas() {
  fireEvent.change(screen.getByLabelText("Início do cronograma"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Fim do cronograma"), { target: { value: "2026-01-31" } });
}

it("mostra feriados declarados apenas enquanto o período consultado permanece selecionado", async () => {
  vi.stubEnv("VITE_SSO_CRONOGRAMA_FERIADOS_DECLARADOS_ENABLED", "true");
  api.feriados.mockResolvedValue({ datas: ["2026-01-01"], conteudo: "fotografia" });
  render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  fireEvent.click(
    screen.getByLabelText("Consultar também declarações cadastradas para este Cliente"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Consultar datas declaradas" }));
  expect(
    await screen.findByRole("list", { name: "Datas declaradas consultadas" }),
  ).toHaveTextContent("2026-01-01");
  fireEvent.change(screen.getByLabelText("Fim do cronograma"), { target: { value: "2026-01-30" } });
  expect(screen.queryByRole("list", { name: "Datas declaradas consultadas" })).toBeNull();
});

it("envia filtros e baixa arquivo parcial após preparo", async () => {
  const criar = vi.fn(() => "blob:teste");
  const revogar = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: criar, revokeObjectURL: revogar });
  const clicar = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  api.preparar.mockResolvedValue(new Blob(["xlsx"]));
  render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  fireEvent.change(screen.getByLabelText("Modo da Rotina"), { target: { value: "visita" } });
  fireEvent.click(screen.getByRole("button", { name: "Exportar cronograma parcial em XLSX" }));
  await waitFor(() => expect(clicar).toHaveBeenCalledTimes(1));
  expect(api.preparar).toHaveBeenCalledWith(
    "user-a",
    { clienteId: "cliente-a", planoId: "plano-a", versaoId: "versao-a" },
    { inicio: "2026-01-01", fim: "2026-01-31", feriadosInformados: [] },
    { modo: "visita" },
    "xlsx",
    expect.any(AbortSignal),
    false,
  );
  expect(revogar).toHaveBeenCalledWith("blob:teste");
  expect(screen.getByText(/cobertura desconhecida/i)).toBeInTheDocument();
});

it("não baixa resultado anterior após troca de Cliente", async () => {
  const criar = vi.fn(() => "blob:teste");
  vi.stubGlobal("URL", { createObjectURL: criar, revokeObjectURL: vi.fn() });
  let resolver!: (arquivo: Blob) => void;
  api.preparar.mockReturnValue(
    new Promise<Blob>((resolve) => {
      resolver = resolve;
    }),
  );
  const { rerender } = render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  fireEvent.click(screen.getByRole("button", { name: "Exportar cronograma parcial em PDF" }));
  rerender(<ExportarCronogramaFotografia {...props} clienteId="cliente-b" />);
  await act(async () => {
    resolver(new Blob(["antigo"]));
  });
  expect(criar).not.toHaveBeenCalled();
});

it("limpa filtros e datas ao trocar de Cliente", () => {
  const { rerender } = render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  fireEvent.change(screen.getByLabelText("Identificador do alvo, opcional"), {
    target: { value: "identidade-cliente-a" },
  });
  fireEvent.change(screen.getByLabelText("Modo da Rotina"), { target: { value: "visita" } });
  rerender(<ExportarCronogramaFotografia {...props} clienteId="cliente-b" />);
  expect(screen.getByLabelText("Identificador do alvo, opcional")).toHaveValue("");
  expect(screen.getByLabelText("Modo da Rotina")).toHaveValue("");
  expect(screen.getByLabelText("Início do cronograma")).toHaveValue("");
});

it("limpa o identificador anterior ao trocar o tipo de alvo", () => {
  render(<ExportarCronogramaFotografia {...props} />);
  fireEvent.change(screen.getByLabelText("Tipo de alvo"), { target: { value: "sistema" } });
  fireEvent.change(screen.getByLabelText("Identificador do alvo, opcional"), {
    target: { value: "00000000-0000-4000-8000-000000000001" },
  });
  fireEvent.change(screen.getByLabelText("Tipo de alvo"), { target: { value: "componente" } });
  expect(screen.getByLabelText("Identificador do alvo, opcional")).toHaveValue("");
  expect(screen.getByLabelText("Tipo de alvo")).toHaveValue("componente");
});

it("não envia identificação ou fotografia do alvo selecionado após trocar de tipo", async () => {
  vi.stubEnv("VITE_SSO_ALVOS_CRONOGRAMA_ENABLED", "true");
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:teste"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  api.preparar.mockResolvedValue(new Blob(["arquivo"]));
  render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  fireEvent.click(screen.getByRole("button", { name: "Selecionar alvo por nome" }));
  fireEvent.click(screen.getByRole("button", { name: "Escolher sistema" }));
  fireEvent.change(screen.getByLabelText("Tipo de alvo"), { target: { value: "componente" } });
  fireEvent.click(screen.getByRole("button", { name: "Exportar cronograma parcial em PDF" }));
  await waitFor(() =>
    expect(api.preparar).toHaveBeenCalledWith(
      "user-a",
      expect.anything(),
      expect.anything(),
      { alvoTipo: "componente" },
      "pdf",
      expect.any(AbortSignal),
      false,
    ),
  );
});

it("recusa janela acima de 366 dias sem consultar servidor", () => {
  render(<ExportarCronogramaFotografia {...props} />);
  fireEvent.change(screen.getByLabelText("Início do cronograma"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Fim do cronograma"), { target: { value: "2027-12-31" } });
  fireEvent.click(screen.getByRole("button", { name: "Exportar cronograma parcial em PDF" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/366 dias/);
  expect(api.preparar).not.toHaveBeenCalled();
});

it("impede edição e envio duplicado enquanto prepara arquivo", () => {
  api.preparar.mockReturnValue(new Promise(() => {}));
  render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  const botao = screen.getByRole("button", { name: "Exportar cronograma parcial em XLSX" });
  fireEvent.click(botao);
  fireEvent.click(botao);
  expect(api.preparar).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Início do cronograma")).toBeDisabled();
  expect(screen.getByLabelText("Modo da Rotina")).toBeDisabled();
});

it("mantém filtro e oferece nova tentativa após recusa do servidor", async () => {
  api.preparar.mockRejectedValue(new Error("sem_acesso"));
  render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  fireEvent.change(screen.getByLabelText("Modo da Rotina"), { target: { value: "visita" } });
  fireEvent.click(screen.getByRole("button", { name: "Exportar cronograma parcial em PDF" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível exportar");
  expect(screen.getByLabelText("Modo da Rotina")).toHaveValue("visita");
  expect(screen.getByRole("button", { name: "Exportar cronograma parcial em PDF" })).toBeEnabled();
});

it("inclui feriados informados na exportação sem registrá-los no servidor", async () => {
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:teste"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  api.preparar.mockResolvedValue(new Blob(["arquivo"]));
  render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  fireEvent.change(screen.getByLabelText("Data de feriado informado"), {
    target: { value: "2026-01-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado informado" }));
  fireEvent.click(screen.getByRole("button", { name: "Exportar cronograma parcial em PDF" }));
  await waitFor(() =>
    expect(api.preparar).toHaveBeenCalledWith(
      "user-a",
      expect.anything(),
      { inicio: "2026-01-01", fim: "2026-01-31", feriadosInformados: ["2026-01-01"] },
      expect.anything(),
      "pdf",
      expect.any(AbortSignal),
      false,
    ),
  );
});

it("permite remover feriado e limpa datas ao trocar de Cliente", () => {
  const { rerender } = render(<ExportarCronogramaFotografia {...props} />);
  preencherDatas();
  const adicionar = () => {
    fireEvent.change(screen.getByLabelText("Data de feriado informado"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar feriado informado" }));
  };
  adicionar();
  adicionar();
  expect(screen.getAllByRole("button", { name: "Remover feriado 2026-01-01" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Remover feriado 2026-01-01" }));
  expect(
    screen.queryByRole("button", { name: "Remover feriado 2026-01-01" }),
  ).not.toBeInTheDocument();
  adicionar();
  rerender(<ExportarCronogramaFotografia {...props} clienteId="cliente-b" />);
  expect(
    screen.queryByRole("button", { name: "Remover feriado 2026-01-01" }),
  ).not.toBeInTheDocument();
});
