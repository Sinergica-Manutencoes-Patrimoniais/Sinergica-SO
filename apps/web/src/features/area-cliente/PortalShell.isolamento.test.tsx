// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ carregar: vi.fn(), user: { id: "a", nome: "Usuário A" } }));
vi.mock("../../app/auth-context", () => ({
  useAuth: () => ({ user: mocks.user, logout: vi.fn() }),
}));
vi.mock("./infrastructure/supabase-portal-adapter", () => ({
  supabasePortalAdapter: { carregar: mocks.carregar },
}));
import { PortalShell } from "./PortalShell";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.user = { id: "a", nome: "Usuário A" };
});

it("oculta dados anteriores quando atualização de acesso falha", async () => {
  mocks.carregar
    .mockResolvedValueOnce({
      cliente: { nome: "Cliente secreto" },
      notificacoes: [],
      visitas: [],
      os: [],
      chamados: [],
      faturas: [],
      conformidade: [],
      documentos: [],
      assessments: [],
      orcamentos: [],
      propostas: [],
      osAguardandoAvaliacao: [],
    })
    .mockRejectedValueOnce(new Error("Acesso revogado"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PortalShell />
    </QueryClientProvider>,
  );
  await screen.findByText("Cliente secreto");
  fireEvent.click(screen.getByText("Notificações"));
  await waitFor(() => expect(screen.getByText("Cliente secreto")).toBeTruthy());
  // A recarga deve ser acionável sem expor novamente dados de um acesso revogado.
  await client.invalidateQueries({ queryKey: ["portal"] });
  await screen.findByText("Acesso revogado");
  expect(screen.queryByText("Cliente secreto")).toBeNull();
});

it("oculta dados do usuário anterior enquanto novo usuário carrega", async () => {
  mocks.carregar
    .mockResolvedValueOnce({
      cliente: { nome: "Cliente A secreto" },
      notificacoes: [],
      visitas: [],
      os: [],
      chamados: [],
      faturas: [],
      conformidade: [],
      documentos: [],
      assessments: [],
      orcamentos: [],
      propostas: [],
      osAguardandoAvaliacao: [],
    })
    .mockImplementationOnce(() => new Promise(() => {}));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = () => (
    <QueryClientProvider client={client}>
      <PortalShell />
    </QueryClientProvider>
  );
  const view = render(wrapper());
  await screen.findByText("Cliente A secreto");
  mocks.user = { id: "b", nome: "Usuário B" };
  view.rerender(wrapper());
  expect(screen.queryByText("Cliente A secreto")).toBeNull();
  expect(screen.getByText("Carregando dados do condomínio…")).toBeTruthy();
});
