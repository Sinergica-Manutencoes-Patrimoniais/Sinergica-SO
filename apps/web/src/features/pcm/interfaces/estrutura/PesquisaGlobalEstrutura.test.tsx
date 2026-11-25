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
function montar(gateway: PesquisaEstruturaGateway, clienteId = "cliente-a") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PesquisaGlobalEstrutura usuario="usuario" clienteId={clienteId} gateway={gateway} />
    </QueryClientProvider>,
  );
}
describe("E01-S190 AC-9/AC-10", () => {
  it("identifica tipos e navega Área → Local preservando retorno", async () => {
    const gateway: PesquisaEstruturaGateway = {
      pesquisar: async (filtro) => (filtro.contexto?.id === "a" ? [local] : [area]),
    };
    montar(gateway);
    await screen.findByRole("button", { name: "Navegar em Área Prédio" });
    fireEvent.click(screen.getByRole("button", { name: "Navegar em Área Prédio" }));
    expect(await screen.findByText("Sala técnica")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao Cliente" }));
    expect(await screen.findByRole("button", { name: "Navegar em Área Prédio" })).toBeTruthy();
  });
  it("envia busca global ao servidor e preserva tipo Equipamento", async () => {
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
    fireEvent.change(screen.getByLabelText("Nome, código ou TAG"), { target: { value: "TAG-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Pesquisar estrutura" }));
    await waitFor(() =>
      expect(pesquisar.mock.calls.some(([filtro]) => filtro.busca === "TAG-01")).toBe(true),
    );
    expect(screen.getAllByText("Equipamento").length).toBeGreaterThan(0);
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
