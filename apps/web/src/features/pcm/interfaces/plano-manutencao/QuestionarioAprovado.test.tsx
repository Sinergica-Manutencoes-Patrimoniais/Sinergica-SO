// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ consultarQuestionarioAprovado: vi.fn() }));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } },
}));
import { QuestionarioAprovado } from "./QuestionarioAprovado";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <QuestionarioAprovado userId="u" clienteId="c" planoId="p" versaoId="v" rotinaId="r" />
    </QueryClientProvider>,
  );
  return client;
}

it("mostra conteúdo histórico reconhecido sem expor campos desconhecidos", async () => {
  api.consultarQuestionarioAprovado.mockResolvedValueOnce({
    rotinaId: "r",
    versaoId: "v",
    questionario: {
      id: "q",
      nome: "Inspeção original",
      cabecalho: "Antes",
      rodape: "Fim",
      perguntas: [{ texto: "Conferir quadro", segredo: "não exibir" }, { tipo: "desconhecido" }],
    },
  });
  montar();
  expect(await screen.findByText("Inspeção original")).toBeTruthy();
  expect(screen.getByText("Conferir quadro")).toBeTruthy();
  expect(screen.getByText(/1 item sem texto reconhecido/)).toBeTruthy();
  const perguntas = screen.getAllByRole("listitem");
  expect(perguntas).toHaveLength(2);
  expect(perguntas[0]?.textContent).toContain("Conferir quadro");
  expect(perguntas[1]?.textContent).toContain("Conteúdo não reconhecido");
  expect(screen.queryByText("não exibir")).toBeNull();
});

it("identifica ausência de questionário histórico", async () => {
  api.consultarQuestionarioAprovado.mockResolvedValueOnce({
    rotinaId: "r",
    versaoId: "v",
    questionario: null,
  });
  montar();
  expect(await screen.findByText(/Nenhum questionário vinculado/)).toBeTruthy();
});

it("erro de consulta permite nova tentativa", async () => {
  api.consultarQuestionarioAprovado
    .mockRejectedValueOnce(new Error("sem acesso"))
    .mockResolvedValueOnce({
      rotinaId: "r",
      versaoId: "v",
      questionario: { id: "q", nome: "Inspeção", cabecalho: null, rodape: null, perguntas: [] },
    });
  montar();
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Inspeção")).toBeTruthy();
});

it("oculta histórico anterior quando revalidação perde acesso", async () => {
  api.consultarQuestionarioAprovado
    .mockResolvedValueOnce({
      rotinaId: "r",
      versaoId: "v",
      questionario: {
        id: "q",
        nome: "Histórico",
        cabecalho: null,
        rodape: null,
        perguntas: [],
      },
    })
    .mockRejectedValueOnce(new Error("sem acesso"));
  const client = montar();
  expect(await screen.findByText("Histórico")).toBeTruthy();
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["plano-manutencao", "u", "c"] });
  });
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Histórico")).toBeNull();
});
