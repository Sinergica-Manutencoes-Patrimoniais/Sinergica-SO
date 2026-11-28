// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  FiltroPesquisaEstrutura,
  PesquisaEstruturaGateway,
  ResultadoEstrutura,
} from "../../application/pesquisa-estrutura-gateway";
import { PesquisaGlobalEstrutura } from "./PesquisaGlobalEstrutura";
vi.mock("../../../../lib/supabase-client", () => ({ supabase: {} }));

const area: ResultadoEstrutura = {
  chave: "area:a",
  tipo: "area",
  id: "a",
  nome: "Prédio",
  codigo: "PR",
  areaId: "a",
  localId: null,
  sistemaId: null,
  parentId: null,
};
const local: ResultadoEstrutura = {
  ...area,
  chave: "local:l",
  tipo: "local",
  id: "l",
  nome: "Sala técnica",
  localId: "l",
};
function montar(
  gateway: Pick<PesquisaEstruturaGateway, "pesquisar"> & Partial<PesquisaEstruturaGateway>,
  clienteId = "cliente-a",
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PesquisaGlobalEstrutura
        usuario="usuario"
        clienteId={clienteId}
        gateway={{ obterResumoGrupo: async () => null, ...gateway }}
      />
    </QueryClientProvider>,
  );
}
describe("E01-S190 AC-9/AC-10", () => {
  it("identifica tipos e navega Área → Local preservando retorno", async () => {
    const gateway = {
      pesquisar: async (filtro: FiltroPesquisaEstrutura) =>
        filtro.contexto?.id === "a" ? [local] : [area],
    };
    montar(gateway);
    await screen.findByRole("button", { name: "Navegar em Área Prédio" });
    fireEvent.click(screen.getByRole("button", { name: "Navegar em Área Prédio" }));
    expect(await screen.findByText("Sala técnica")).toBeTruthy();
    expect(screen.getAllByText("Área: Prédio", { exact: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao Cliente" }));
    expect(await screen.findByRole("button", { name: "Navegar em Área Prédio" })).toBeTruthy();
  });
  it("envia busca global ao servidor e preserva tipo equipamento (Principal)", async () => {
    const pesquisar = vi.fn(async (_filtro: FiltroPesquisaEstrutura) => [
      {
        ...local,
        chave: "equipamento:e",
        tipo: "equipamento" as const,
        id: "e",
        nome: "Bomba",
        codigo: "TAG-01",
      },
    ]);
    montar({ pesquisar });
    await screen.findByText("Bomba");
    fireEvent.change(screen.getByRole("textbox", { name: "Pesquisar estrutura" }), {
      target: { value: "TAG-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar estrutura" }));
    await waitFor(() =>
      expect(pesquisar.mock.calls.some(([filtro]) => filtro.busca === "TAG-01")).toBe(true),
    );
    expect(screen.getAllByText("Componente (Principal)").length).toBeGreaterThan(0);
  });
  // DEF-28: "Equipamento" é a entidade do Auvo (ADR-0022/glossário); o ativo do cliente com
  // `tipo` = 'equipamento' nunca pode aparecer rotulado como "Equipamento" cru na pesquisa —
  // o testador interpretou isso como classificação divergente da exportação (que chama tudo de
  // "Componentes"), quando na verdade era só o rótulo proibido vazando na UI.
  it("DEF-28: nunca rotula um ativo do cliente como 'Equipamento' cru", async () => {
    const pesquisar = vi.fn(async () => [
      {
        ...local,
        chave: "equipamento:e",
        tipo: "equipamento" as const,
        id: "e",
        nome: "Válvula",
        codigo: "TAG-02",
      },
    ]);
    montar({ pesquisar });
    await screen.findByText("Válvula");
    expect(screen.queryByText("Equipamento")).toBeNull();
    expect(screen.getAllByText("Componente (Principal)").length).toBeGreaterThan(0);
  });
  it("falha de autorização esconde resultados e informa a recusa", async () => {
    montar({
      pesquisar: async () => {
        throw { code: "42501" };
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem permissão");
    expect(screen.queryByText("Sala técnica")).toBeNull();
  });
});

it("mostra quantidade, Local e Sistema no detalhe do Grupo Quantitativo", async () => {
  const grupo: ResultadoEstrutura = {
    ...local,
    chave: "grupo_quantitativo:g",
    tipo: "grupo_quantitativo",
    id: "g",
    nome: "Bombas",
  };
  const gateway = {
    pesquisar: async () => [grupo],
    obterResumoGrupo: vi.fn(async () => ({
      quantidade: 3,
      local: "Sala técnica",
      sistema: "Hidráulica",
      temSistema: true,
    })),
  };
  montar(gateway);
  fireEvent.click(await screen.findByRole("button", { name: "Ver Grupo Quantitativo Bombas" }));
  expect(await screen.findByText("3 unidades")).toBeVisible();
  expect(screen.getByText("Sala técnica")).toBeVisible();
  expect(screen.getByText("Hidráulica")).toBeVisible();
});
