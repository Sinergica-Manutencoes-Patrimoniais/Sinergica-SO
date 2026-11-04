// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ preverRevisao: vi.fn() }));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
import { PreviaRevisao } from "./PreviaRevisao";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function montar(revisao = 2) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PreviaRevisao userId="usuario" clienteId="cliente" planoId="plano" revisao={revisao} />
    </QueryClientProvider>,
  );
}
function item(id: string, revisao = 2) {
  return {
    rotinaLogicaId: id,
    rotinaAnteriorId: id,
    rotinaRascunhoId: id,
    nomeAnterior: `Antiga ${id}`,
    nomeRascunho: `Nova ${id}`,
    classificacao: "alterada",
    revisao,
    impactosOperacionaisPendentes: true,
  };
}

it("informa que impactos e aprovação continuam pendentes ao consultar a revisão", async () => {
  api.preverRevisao.mockResolvedValueOnce([item("1")]);
  montar();
  expect(await screen.findByText(/Nova 1 — Alterada/)).toBeTruthy();
  expect(screen.getByText(/Impactos em Ocorrências e OS não foram calculados/)).toBeTruthy();
  expect(screen.getByText(/aprovação da nova versão permanece bloqueada/)).toBeTruthy();
});

it("não mostra comparação de revisão desatualizada", async () => {
  api.preverRevisao.mockResolvedValueOnce([item("1", 1)]);
  montar();
  expect(await screen.findByRole("alert")).toHaveTextContent("O Plano mudou");
  expect(screen.queryByText(/Nova 1 — Alterada/)).toBeNull();
});

it("erro na consulta oculta os dados e permite nova tentativa", async () => {
  api.preverRevisao
    .mockRejectedValueOnce(new Error("acesso negado"))
    .mockResolvedValueOnce([item("1")]);
  montar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível comparar");
  expect(screen.queryByText(/Nova 1 — Alterada/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText(/Nova 1 — Alterada/)).toBeTruthy();
});

it("paginação mantém o primeiro lote e mostra os resultados seguintes", async () => {
  const primeiraPagina = Array.from({ length: 20 }, (_, i) => item(String(i + 1)));
  api.preverRevisao.mockResolvedValueOnce(primeiraPagina).mockResolvedValueOnce([item("21")]);
  montar();
  expect(await screen.findByText(/Nova 1 — Alterada/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mais resultados" }));
  expect(await screen.findByText(/Nova 21 — Alterada/)).toBeTruthy();
  expect(screen.getByText(/Nova 1 — Alterada/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mais resultados" })).toBeNull();
  expect(api.preverRevisao).toHaveBeenLastCalledWith("plano", 20, "20", expect.any(AbortSignal));
});
