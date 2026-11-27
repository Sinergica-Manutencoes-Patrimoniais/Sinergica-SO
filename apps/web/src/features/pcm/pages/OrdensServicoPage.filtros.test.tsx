// @vitest-environment jsdom
import { TooltipProvider } from "@sinergica/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ConsultaOperacao, ItemOperacaoResumo } from "../application/operacao-gateway";
import { OPERACAO_KPI_VAZIO } from "../application/operacao-queries";
import { OrdensServicoPage } from "./OrdensServicoPage";

const { carregarDadosAbertura, listarPagina, listarProximasPreventivas } = vi.hoisted(() => ({
  carregarDadosAbertura: vi.fn(),
  listarPagina: vi.fn(),
  listarProximasPreventivas: vi.fn(),
}));

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "usuario" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../../../config/flags-sso", () => ({ flagLigada: () => false }));
vi.mock("../application/pmoc", () => ({ listarProximasPreventivas }));
vi.mock("../application/kanban-colunas", () => ({
  obterPreferenciaColunas: async () => {
    throw new Error("Preferência não cadastrada");
  },
  salvarPreferenciaColunas: vi.fn(),
}));
vi.mock("../infrastructure/supabase-operacao-adapter", () => ({
  supabaseOperacaoAdapter: { listarPagina, contarKpis: async () => OPERACAO_KPI_VAZIO },
}));
vi.mock("../infrastructure/supabase-ordem-servico-adapter", () => ({
  supabaseOrdemServicoAdapter: { carregarDadosAbertura },
}));
vi.mock("../interfaces/listas-materiais/Central", () => ({ CentralMateriaisGlobal: () => null }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function montar(
  props: Pick<Parameters<typeof OrdensServicoPage>[0], "filtrosIniciais" | "abaInicial">,
) {
  carregarDadosAbertura.mockResolvedValue({
    clientes: [{ id: "cliente-a", nome: "Cliente A" }],
    tecnicos: [],
    tiposTarefa: [],
  });
  if (!listarPagina.getMockImplementation()) {
    listarPagina.mockResolvedValue({ itens: [], proximoCursor: null, total: 0 });
  }
  if (!listarProximasPreventivas.getMockImplementation())
    listarProximasPreventivas.mockResolvedValue([]);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TooltipProvider>
        <OrdensServicoPage onNovaOs={vi.fn()} {...props} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

it.each(["kanban", "lista"] as const)(
  "carrega Clientes na visão %s antes do foco",
  async (abaInicial) => {
    montar({ abaInicial });
    expect(await screen.findByRole("option", { name: "Cliente A" })).toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por cliente")).not.toHaveFocus();
  },
);

it("a página mostra o vazio de cadastro quando a Lista não tem busca (DEF-34)", async () => {
  montar({});
  expect(await screen.findByText("Nenhuma OS cadastrada ainda.")).toBeVisible();
});

it("distingue feed vazio com busca ativa de ausência de cadastro (DEF-34)", async () => {
  montar({ filtrosIniciais: { busca: "CH-FICTICIO" } });
  expect(await screen.findByText("Nenhuma OS para estes filtros.")).toBeVisible();
});

it("aplica o cliente selecionado também à coluna de Preventivas (DEF-01)", async () => {
  listarProximasPreventivas.mockResolvedValue(
    ["cliente-a", "cliente-b"].map((clienteId) => ({
      id: clienteId,
      contractId: `contrato-${clienteId}`,
      clienteId,
      clienteNome: clienteId,
      imovelNome: `Imóvel ${clienteId}`,
      scheduledDate: "2027-01-05",
      maintenanceType: "mensal",
      status: "agendado",
    })),
  );
  montar({ abaInicial: "kanban", filtrosIniciais: { clienteId: "cliente-a" } });
  expect(await screen.findByText("Imóvel cliente-a")).toBeVisible();
  expect(screen.queryByText("Imóvel cliente-b")).not.toBeInTheDocument();
});

it("mantém o chamado aberto sem OS ao alternar para Kanban (DEF-02)", async () => {
  const chamado: ItemOperacaoResumo = {
    id: "chamado-aberto:ch-ficticio",
    tipo: "chamado_aberto",
    ordemServicoId: null,
    chamadoId: "ch-ficticio",
    clienteId: "cliente-a",
    clienteNome: "Cliente A",
    numero: "CH-9902",
    titulo: "Chamado avulso fictício",
    categoria: "corretiva",
    origem: "manual",
    status: "aberto",
    prioridade: "normal",
    gravidade: null,
    urgencia: null,
    tendencia: null,
    dorCliente: null,
    scorePcm: 0,
    origemInspecaoItemId: null,
    auvoTaskId: null,
    auvoSyncStatus: null,
    auvoSyncError: null,
    createdAt: "2026-11-27T12:00:00Z",
    tecnicoFuncionarioId: null,
    tecnicoNome: null,
    dataAgendada: null,
    checkInAt: null,
    checkOutAt: null,
    tipoOs: null,
    pmocScheduleId: null,
    orientacao: null,
    ocorrenciaPreventivaId: null,
  };
  listarPagina.mockImplementation(async ({ status }: ConsultaOperacao) => {
    // operacao_itens preserva status aberto. O adaptador compara por igualdade em recortes de fase.
    const itens = status === "ativos" || status === "todos" || status === "aberto" ? [chamado] : [];
    return { itens, proximoCursor: null, total: itens.length };
  });
  montar({ filtrosIniciais: { busca: chamado.numero } });
  expect(await screen.findByText(chamado.titulo)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Kanban" }));
  expect(await screen.findByRole("button", { name: "Ocultar coluna Preventiva" })).toBeVisible();
  expect(await screen.findByText(chamado.titulo)).toBeVisible();
  expect(listarPagina.mock.calls.some(([consulta]) => consulta.status === "solicitacao")).toBe(
    true,
  );
});
