// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CustosPessoalPage } from "./CustosPessoalPage";

const { listarCustos } = vi.hoisted(() => ({ listarCustos: vi.fn() }));

vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "usuario" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../infrastructure/supabase-financeiro-adapter", () => ({
  supabaseFinanceiroAdapter: {
    listarCustosFuncionario: listarCustos,
    listarFuncionariosOpcoes: async () => [{ id: "funcionario", nome: "Ana" }],
  },
}));

const custoMensal = {
  id: "custo-atual",
  funcionarioId: "funcionario",
  custoMensalCentavos: 500_000,
  horasMesBase: 220,
  vigenteDesde: "2026-01-01",
};

it("exibe R$ 22,73 por hora para R$ 5.000 por mês em 220 horas", async () => {
  listarCustos.mockResolvedValue([custoMensal]);
  render(<CustosPessoalPage />);

  const nome = await screen.findByRole("heading", { name: "Ana" });
  expect(nome.parentElement?.textContent).toContain("R$ 22,73/hora");
});
