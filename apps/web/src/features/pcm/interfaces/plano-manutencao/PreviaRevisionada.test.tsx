// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ preverRevisaoRevisionada: vi.fn(), getUser: vi.fn() }));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser } } }));
import { PreviaRevisionada } from "./PreviaRevisionada";
beforeEach(() => { api.getUser.mockResolvedValue({ data: { user: { id: "u" } }, error: null }); });
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("oculta a comparação se a sessão mudar durante a leitura", async () => {
  api.getUser.mockResolvedValueOnce({ data: { user: { id: "u" } }, error: null }).mockResolvedValueOnce({ data: { user: { id: "outro" } }, error: null });
  api.preverRevisaoRevisionada.mockResolvedValue({ revision: 5, versaoAnteriorId: "v1", versaoRascunhoId: "v2", nextCursor: null, impactosOperacionaisPendentes: true, items: [] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PreviaRevisionada userId="u" clienteId="c" planoId="p" revisao={5} /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível comparar");
  expect(screen.queryByText("Nenhuma Rotina para comparar.")).toBeNull();
});
it("mostra campos de ambas as versões e explicita questionário indeterminado", async () => {
  const base = {
    id: "rotina",
    nome: "Inspeção",
    alvo_tipo: "sistema",
    sistema_id: "alvo",
    equipamento_id: null,
    grupo_id: null,
    modo: "calendario",
    intervalo_n: 1,
    intervalo_unidade: "meses",
    data_base: "2026-01-01",
    tempo_minutos: 30,
    tipo_tempo: "total",
    tolerancia_antes: 0,
    tolerancia_depois: 0,
    instrucao: "Inspecionar",
    questionario_id: "q",
  };
  api.preverRevisaoRevisionada.mockResolvedValue({
    revision: 5,
    versaoAnteriorId: "v1",
    versaoRascunhoId: "v2",
    nextCursor: null,
    impactosOperacionaisPendentes: true,
    items: [
      {
        rotinaLogicaId: "r",
        classificacao: "questionario_indeterminado",
        questionarioConteudoPendente: true,
        anterior: base,
        rascunho: { ...base, nome: "Inspeção revisada" },
      },
    ],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PreviaRevisionada userId="u" clienteId="c" planoId="p" revisao={5} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /detalhes.*Inspeção revisada/i }));
  expect(screen.getByText("Inspeção")).toBeTruthy();
  expect(screen.getByText("Inspeção revisada")).toBeTruthy();
  expect(screen.getByText(/conteúdo do questionário.*não foi comparado/i)).toBeTruthy();
  expect(screen.getByText(/impactos.*não foram calculados/i)).toBeTruthy();
});
it("oculta todas as páginas se uma resposta pertence a outra revisão", async () => {
  const campos = { nome: "Rotina anterior" };
  api.preverRevisaoRevisionada
    .mockResolvedValueOnce({
      revision: 5,
      versaoAnteriorId: "v1",
      versaoRascunhoId: "v2",
      nextCursor: "cursor",
      impactosOperacionaisPendentes: true,
      items: [
        {
          rotinaLogicaId: "r",
          classificacao: "alterada",
          anterior: campos,
          rascunho: campos,
          questionarioConteudoPendente: false,
        },
      ],
    })
    .mockResolvedValueOnce({
      revision: 6,
      versaoAnteriorId: "v1",
      versaoRascunhoId: "v2",
      nextCursor: null,
      impactosOperacionaisPendentes: true,
      items: [],
    });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PreviaRevisionada userId="u" clienteId="c" planoId="p" revisao={5} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Mais resultados" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("O Plano mudou");
  expect(screen.queryByText(/Rotina anterior —/)).toBeNull();
});
it("descarta resposta atrasada de revisão anterior", async () => {
  let terminar!: (valor: unknown) => void;
  const pagina = (revision: number, nome: string) => ({
    revision,
    versaoAnteriorId: "v1",
    versaoRascunhoId: "v2",
    nextCursor: null,
    impactosOperacionaisPendentes: true,
    items: [
      {
        rotinaLogicaId: "r",
        classificacao: "alterada",
        anterior: null,
        rascunho: { nome },
        questionarioConteudoPendente: false,
      },
    ],
  });
  api.preverRevisaoRevisionada.mockImplementation((_p, revision) =>
    revision === 5
      ? new Promise((resolve) => {
          terminar = resolve;
        })
      : Promise.resolve(pagina(6, "Nova")),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <PreviaRevisionada userId="u" clienteId="c" planoId="p" revisao={5} />
    </QueryClientProvider>,
  );
  await screen.findByText("Carregando comparação...");
  view.rerender(
    <QueryClientProvider client={client}>
      <PreviaRevisionada userId="u" clienteId="c" planoId="p" revisao={6} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/Nova — Alterada/)).toBeTruthy();
  await act(async () => {
    terminar(pagina(5, "Antiga"));
  });
  expect(screen.queryByText(/Antiga — Alterada/)).toBeNull();
});
it("oculta páginas anteriores quando nova página perde acesso", async () => {
  api.preverRevisaoRevisionada
    .mockResolvedValueOnce({
      revision: 5,
      versaoAnteriorId: "v1",
      versaoRascunhoId: "v2",
      nextCursor: "cursor",
      impactosOperacionaisPendentes: true,
      items: [
        {
          rotinaLogicaId: "r",
          classificacao: "alterada",
          anterior: null,
          rascunho: { nome: "Conteúdo antigo" },
          questionarioConteudoPendente: false,
        },
      ],
    })
    .mockRejectedValueOnce({ code: "42501" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PreviaRevisionada userId="u" clienteId="c" planoId="p" revisao={5} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Mais resultados" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível comparar");
  expect(screen.queryByText(/Conteúdo antigo —/)).toBeNull();
});
