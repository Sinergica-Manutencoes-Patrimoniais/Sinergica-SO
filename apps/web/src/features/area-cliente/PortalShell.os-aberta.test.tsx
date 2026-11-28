// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ carregar: vi.fn() }));
vi.mock("../../app/auth-context", () => ({
  useAuth: () => ({ user: { id: "a", nome: "Síndico" }, logout: vi.fn() }),
}));
vi.mock("./infrastructure/supabase-portal-adapter", () => ({
  supabasePortalAdapter: { carregar: mocks.carregar },
}));
import { PortalShell } from "./PortalShell";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const os = (id: string, status: string) => ({
  id,
  numero: id,
  titulo: id,
  status,
  categoria: "corretiva",
  createdAt: "2026-11-01T00:00:00Z",
});

// E01-S206: o Painel mostra a contagem de OS aberta do banco (migration 1913); finalizada e
// cancelada (status reais do sistema) ficam de fora, mesmo presentes na lista.
it("OS em andamento = só a aberta; finalizada e cancelada não entram", async () => {
  mocks.carregar.mockResolvedValue({
    cliente: { nome: "Condomínio" },
    notificacoes: [],
    visitas: [],
    os: [os("OS-1", "solicitacao"), os("OS-2", "finalizado"), os("OS-3", "cancelado")],
    osAbertas: 1,
    chamados: [],
    faturas: [],
    conformidade: [],
    documentos: [],
    assessments: [],
    orcamentos: [],
    propostas: [],
    osAguardandoAvaliacao: [],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PortalShell />
    </QueryClientProvider>,
  );
  const titulo = await screen.findByText("OS em andamento");
  expect(titulo.parentElement?.textContent).toContain("1");
  expect(titulo.parentElement?.textContent).not.toContain("3");
});
