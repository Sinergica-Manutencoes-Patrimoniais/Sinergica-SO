// @vitest-environment jsdom
// DEF-31: o cartão da conta exibia a data de corte um dia antes da gravada. A coluna
// `saldo_inicial_em` é `date` ("2026-11-25"); `new Date(...)` a lia como meia-noite UTC e
// o pt-BR em UTC-3 renderizava 24/11/2026, divergindo do formulário de edição.
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ContasPage } from "./ContasPage";

const mocks = vi.hoisted(() => ({ listar: vi.fn() }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "A" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../infrastructure/supabase-financeiro-adapter", () => ({
  supabaseFinanceiroAdapter: { listarContas: mocks.listar },
}));

const conta = {
  id: "28400000-0000-4000-8000-000000000001",
  nome: "Conta zero de teste",
  banco: null,
  saldoInicialCentavos: 0,
  saldoInicialEm: "2026-11-25",
  ativo: true,
  saldoAtualCentavos: 0,
};

beforeEach(() => {
  mocks.listar.mockReset();
});

it("exibe a data de corte gravada, sem recuar um dia por fuso", async () => {
  mocks.listar.mockResolvedValue([conta]);
  render(<ContasPage />);
  const linha = await screen.findByText(/Saldo inicial/);
  expect(linha.textContent).toContain("em 25/11/2026");
  expect(linha.textContent).not.toContain("24/11/2026");
});
