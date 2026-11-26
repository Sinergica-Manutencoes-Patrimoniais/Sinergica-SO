// @vitest-environment jsdom
// DEF-47: o cartão "Resultado do filtro" exibia o módulo do valor; com apenas saídas,
// R$ -1,37 aparecia como R$ 1,37 e só a cor indicava o negativo.
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { LancamentosPage } from "./LancamentosPage";

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
}));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "A" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../infrastructure/supabase-financeiro-adapter", () => ({
  supabaseFinanceiroAdapter: {
    listarLancamentos: mocks.listar,
    baixarComprovante: vi.fn(),
    listarCategorias: async () => [],
    listarContas: async () => [],
    listarClientesOpcoes: async () => [],
  },
}));

const saida = {
  id: "18400000-0000-4000-8000-000000000001",
  tipo: "saida",
  status: "previsto",
  valorCentavos: 137,
  dataCompetencia: "2026-11-25",
  dataVencimento: null,
  dataPagamento: null,
  categoriaId: "categoria",
  contaId: null,
  clienteId: null,
  fornecedorId: null,
  osId: null,
  origem: "manual",
  extratoTransacaoId: null,
  descricao: "Saída de teste",
  comprovantePath: null,
};

beforeEach(() => {
  mocks.listar.mockReset();
});

it("exibe o resultado negativo com sinal quando só há saídas", async () => {
  mocks.listar.mockResolvedValue([saida]);
  render(<LancamentosPage />);
  await screen.findByText("Saída de teste");
  const resultado = screen.getByText("Resultado do filtro").parentElement;
  expect(resultado?.textContent).toContain("R$ -1,37");
});

it("não prefixa sinal no total de saídas, que é um módulo", async () => {
  mocks.listar.mockResolvedValue([saida]);
  render(<LancamentosPage />);
  await screen.findByText("Saída de teste");
  const saidas = screen.getByText("Saídas").parentElement;
  expect(saidas?.textContent).toContain("R$ 1,37");
  expect(saidas?.textContent).not.toContain("-");
});
