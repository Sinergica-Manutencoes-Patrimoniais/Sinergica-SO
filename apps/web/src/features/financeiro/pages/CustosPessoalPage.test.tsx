// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
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

function renderizarPagina() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <CustosPessoalPage />
    </QueryClientProvider>,
  );
}

const custoMensal = {
  id: "custo-atual",
  funcionarioId: "funcionario",
  custoMensalCentavos: 500_000,
  horasMesBase: 220,
  vigenteDesde: "2026-01-01",
};

it("exibe R$ 22,73 por hora para R$ 5.000 por mês em 220 horas", async () => {
  listarCustos.mockResolvedValue([custoMensal]);
  renderizarPagina();

  const nome = await screen.findByRole("heading", { name: "Ana" });
  expect(nome.parentElement?.textContent).toContain("R$ 22,73/hora");
});

afterEach(() => vi.useRealTimers());

const custoFuturo = {
  ...custoMensal,
  id: "custo-futuro",
  custoMensalCentavos: 660_000,
  vigenteDesde: "2027-02-16",
};

it.each([
  { dia: 15, custos: [custoFuturo, custoMensal], esperado: "R$ 22,73/hora" },
  { dia: 16, custos: [custoFuturo, custoMensal], esperado: "R$ 30,00/hora" },
  { dia: 15, custos: [custoFuturo], esperado: "Sem custo vigente" },
])("exibe $esperado em $dia/02/2027", async ({ dia, custos, esperado }) => {
  vi.setSystemTime(new Date(2027, 1, dia, 12));
  listarCustos.mockResolvedValue(custos);
  renderizarPagina();

  const nome = await screen.findByRole("heading", { name: "Ana" });
  expect(nome.parentElement?.textContent).toContain(esperado);
  expect(screen.getByText(/Desde 16\/02\/2027/)).toBeInTheDocument();
});
