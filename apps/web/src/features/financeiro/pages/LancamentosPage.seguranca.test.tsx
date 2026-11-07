// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LancamentosPage } from "./LancamentosPage";

const mocks = vi.hoisted(() => ({
  usuario: { id: "A", papel: "supervisor" },
  acesso: true,
  listar: vi.fn(),
  baixar: vi.fn(),
}));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: mocks.usuario }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => mocks.acesso }),
}));
vi.mock("../infrastructure/supabase-financeiro-adapter", () => ({
  supabaseFinanceiroAdapter: {
    listarLancamentos: mocks.listar,
    baixarComprovante: mocks.baixar,
    listarCategorias: async () => [],
    listarContas: async () => [],
    listarClientesOpcoes: async () => [],
  },
}));

const item = {
  id: "18400000-0000-4000-8000-000000000001",
  tipo: "saida",
  status: "realizado",
  valorCentavos: 4200,
  dataCompetencia: "2026-10-01",
  dataVencimento: null,
  dataPagamento: "2026-10-01",
  categoriaId: "categoria",
  contaId: null,
  clienteId: null,
  fornecedorId: null,
  osId: null,
  origem: "manual",
  extratoTransacaoId: null,
  descricao: "Dado financeiro privado A",
  comprovantePath: null,
};

beforeEach(() => {
  mocks.usuario = { id: "A", papel: "supervisor" };
  mocks.acesso = true;
  mocks.listar.mockReset();
  mocks.baixar.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("conclui a carga inicial mesmo quando o efeito é repetido em StrictMode", async () => {
  mocks.listar.mockResolvedValue([item]);
  render(
    <StrictMode>
      <LancamentosPage />
    </StrictMode>,
  );
  expect(await screen.findByText("Dado financeiro privado A")).toBeTruthy();
});

it("baixa comprovante autorizado pelo identificador do lançamento", async () => {
  mocks.listar.mockResolvedValueOnce([{ ...item, comprovantePath: "caminho-privado" }]);
  mocks.baixar.mockResolvedValueOnce(new Blob(["%PDF-1.7"]));
  const criar = vi.fn().mockReturnValue("blob:arquivo");
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, { createObjectURL: criar, revokeObjectURL: vi.fn() }),
  );
  const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<LancamentosPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Baixar comprovante" }));
  await waitFor(() => expect(clique).toHaveBeenCalledOnce());
  expect(mocks.baixar).toHaveBeenCalledWith(item.id);
  expect(criar).toHaveBeenCalledOnce();
});

it("não entrega comprovante de sessão anterior depois da troca", async () => {
  let concluir!: (valor: Blob) => void;
  mocks.listar
    .mockResolvedValueOnce([{ ...item, comprovantePath: "privado" }])
    .mockResolvedValueOnce([]);
  mocks.baixar.mockReturnValueOnce(
    new Promise((resolve) => {
      concluir = resolve;
    }),
  );
  const criar = vi.fn().mockReturnValue("blob:arquivo");
  const leitura = vi.spyOn(FileReader.prototype, "readAsArrayBuffer").mockImplementation(() => {});
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, { createObjectURL: criar, revokeObjectURL: vi.fn() }),
  );
  const tela = render(<LancamentosPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Baixar comprovante" }));
  mocks.usuario = { id: "B", papel: "supervisor" };
  tela.rerender(<LancamentosPage />);
  await act(async () => {
    concluir(new Blob(["%PDF-1.7"]));
  });
  expect(criar).not.toHaveBeenCalled();
  expect(leitura).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("não entrega comprovante iniciado antes de reconsulta recusada", async () => {
  let concluir!: (valor: Blob) => void;
  mocks.listar
    .mockResolvedValueOnce([{ ...item, comprovantePath: "privado" }])
    .mockRejectedValueOnce(new Error("acesso revogado"));
  mocks.baixar.mockReturnValueOnce(
    new Promise((resolve) => {
      concluir = resolve;
    }),
  );
  const criar = vi.fn().mockReturnValue("blob:arquivo");
  const leitura = vi.spyOn(FileReader.prototype, "readAsArrayBuffer").mockImplementation(() => {});
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, { createObjectURL: criar, revokeObjectURL: vi.fn() }),
  );
  render(<LancamentosPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Baixar comprovante" }));
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "previsto" } });
  await screen.findByText("acesso revogado");
  await act(async () => {
    concluir(new Blob(["%PDF-1.7"]));
  });
  expect(criar).not.toHaveBeenCalled();
  expect(leitura).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

it("não apresenta lançamentos de outra identidade durante troca de sessão", async () => {
  mocks.listar.mockResolvedValueOnce([item]).mockReturnValueOnce(new Promise(() => {}));
  const tela = render(<LancamentosPage />);
  await screen.findByText("Dado financeiro privado A");
  mocks.usuario = { id: "B", papel: "supervisor" };
  tela.rerender(<LancamentosPage />);
  expect(screen.queryByText("Dado financeiro privado A")).toBeNull();
});

it("mostra acesso restrito sem carregar lançamentos quando não há permissão", () => {
  mocks.acesso = false;
  render(<LancamentosPage />);
  expect(screen.getByText("Acesso restrito")).toBeTruthy();
  expect(mocks.listar).not.toHaveBeenCalled();
});

it("oculta dados anteriores quando reconsulta financeira é recusada", async () => {
  mocks.listar.mockResolvedValueOnce([item]).mockRejectedValueOnce(new Error("acesso revogado"));
  render(<LancamentosPage />);
  await screen.findByText("Dado financeiro privado A");
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "previsto" } });
  await screen.findByText("acesso revogado");
  expect(screen.queryByText("Dado financeiro privado A")).toBeNull();
});

it("oculta dados financeiros anteriores enquanto reconsulta está pendente", async () => {
  mocks.listar.mockResolvedValueOnce([item]).mockReturnValueOnce(new Promise(() => {}));
  render(<LancamentosPage />);
  await screen.findByText("Dado financeiro privado A");
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "previsto" } });
  expect(screen.queryByText("Dado financeiro privado A")).toBeNull();
});

it("não exibe resultado financeiro antigo que termina após troca de sessão", async () => {
  let concluir!: (valor: unknown[]) => void;
  mocks.listar
    .mockReturnValueOnce(
      new Promise((resolve) => {
        concluir = resolve;
      }),
    )
    .mockResolvedValueOnce([]);
  const tela = render(<LancamentosPage />);
  mocks.usuario = { id: "B", papel: "supervisor" };
  tela.rerender(<LancamentosPage />);
  await act(async () => concluir([item]));
  expect(screen.queryByText("Dado financeiro privado A")).toBeNull();
});
