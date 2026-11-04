// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DespesasVisitaWorkspace } from "./Workspace";

const servidor = vi.hoisted(() => ({
  despesas: [] as object[],
  categorias: [{ id: "18000000-0000-4000-8000-000000000003", nome: "Transporte" }],
}));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "18000000-0000-4000-8000-000000000001" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: async () => true },
}));
vi.mock("../../infrastructure/supabase-despesas-visita-adapter", () => ({
  listarCategoriasDespesa: async (apos: unknown) => {
    const i =
      typeof apos === "string" ? servidor.categorias.findIndex((c) => c.id === apos) + 1 : 0;
    return servidor.categorias.slice(i, i + 100);
  },
  listarDespesasVisita: async () => [...servidor.despesas],
  supabaseDespesasVisitaAdapter: {},
}));
vi.mock("../../application/despesas-visita", () => ({
  criarDespesaVisita: async (
    _gateway: unknown,
    pedido: { despesaId: string; descricao: string; data: string; previstoCentavos: number },
  ) => {
    servidor.despesas.push({
      id: pedido.despesaId,
      descricao: pedido.descricao,
      data: pedido.data,
      previstoCentavos: pedido.previstoCentavos,
      realizadoCentavos: null,
      status: "ativa",
      revisao: 1,
    });
  },
}));
vi.mock("./EditarPrevisao", () => ({ EditarPrevisao: () => null }));
vi.mock("./DeclararRepasse", () => ({ DeclararRepasse: () => null }));
vi.mock("./BaixarComprovante", () => ({ BaixarComprovante: () => null }));
vi.mock("./RateioDespesa", () => ({ RateioDespesa: () => null }));
vi.mock("./CorrigirRealizada", () => ({ CorrigirRealizada: () => null }));
vi.mock("./CorrigirValorComprovante", () => ({ CorrigirValorComprovante: () => null }));
vi.mock("./HistoricoComprovantes", () => ({ HistoricoComprovantes: () => null }));
vi.mock("./ResumoDespesas", () => ({ ResumoDespesas: () => null }));
vi.mock("./RelatorioClienteDespesas", () => ({ RelatorioClienteDespesas: () => null }));
vi.mock("./AtribuirTecnico", () => ({ AtribuirTecnico: () => null }));
vi.mock("./RealizarDespesa", () => ({ RealizarDespesa: () => null }));
vi.mock("./ConferenciaDespesa", () => ({ ConferenciaDespesa: () => null }));
vi.mock("./HistoricoRateio", () => ({ HistoricoRateio: () => null }));

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  servidor.despesas = [];
  servidor.categorias = [{ id: "18000000-0000-4000-8000-000000000003", nome: "Transporte" }];
});

it("permite escolher categoria além da primeira página", async () => {
  servidor.categorias = Array.from({ length: 101 }, (_, indice) => ({
    id: `18000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
    nome: `Categoria ${indice + 1}`,
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DespesasVisitaWorkspace
        userId="18000000-0000-4000-8000-000000000001"
        clienteId="18000000-0000-4000-8000-000000000002"
        visitaId="18000000-0000-4000-8000-000000000004"
        habilitado
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: "Categoria 100" });
  fireEvent.click(screen.getByRole("button", { name: "Mais categorias" }));
  expect(await screen.findByRole("option", { name: "Categoria 101" })).toBeTruthy();
});

it("exibe despesa confirmada quando a limpeza da tentativa local falha", async () => {
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new Error("armazenamento indisponível");
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const relatorio = [
    "relatorio-despesas-cliente",
    "18000000-0000-4000-8000-000000000001",
    "18000000-0000-4000-8000-000000000002",
    "2026-10",
  ];
  client.setQueryData(relatorio, { total: 0 });
  render(
    <QueryClientProvider client={client}>
      <DespesasVisitaWorkspace
        userId="18000000-0000-4000-8000-000000000001"
        clienteId="18000000-0000-4000-8000-000000000002"
        visitaId="18000000-0000-4000-8000-000000000004"
        habilitado
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: "Transporte" });
  fireEvent.change(screen.getByLabelText(/Categoria/), {
    target: { value: "18000000-0000-4000-8000-000000000003" },
  });
  fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: "2026-10-30" } });
  fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: "Táxi sintético" } });
  fireEvent.change(screen.getByLabelText(/Valor previsto/), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar previsão" }));
  expect(await screen.findByText(/Táxi sintético — previsto/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Repetir tentativa" })).toBeTruthy();
  expect(client.getQueryState(relatorio)?.isInvalidated).toBe(true);
});
