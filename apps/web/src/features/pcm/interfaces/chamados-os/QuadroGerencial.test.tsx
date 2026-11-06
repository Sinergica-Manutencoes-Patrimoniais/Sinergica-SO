// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuadroGerencial } from "./QuadroGerencial";
const resposta = vi.hoisted(() => ({ dados: [] as unknown[], error: null as Error | null }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: () => ({ abortSignal: async () => ({ data: resposta.dados, error: resposta.error }) }) }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-chamados-os-leitura-adapter", () => ({ supabaseChamadosOsLeituraAdapter: { listar: async () => [] } }));
afterEach(() => { cleanup(); resposta.dados = []; resposta.error = null; });
it("mostra um Chamado com progresso integral e etapas mistas", async () => {
  resposta.dados = [{ id: "16798001-0000-4000-8000-000000000011", numero: "CH-1", titulo: "Quadro elétrico", status_chamado: "convertido_os", total_os: 2, finalizadas: 1, etapas_mistas: true, vinculo_inconsistente: false }];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><QuadroGerencial usuario="u" cliente="c" /></QueryClientProvider>);
  expect(await screen.findByText(/CH-1 · Quadro elétrico · Em andamento/)).toBeTruthy();
  expect(screen.getByText("1 de 2 OS finalizadas")).toBeTruthy();
  expect(screen.queryByText(/convertido_os/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Ver OS de CH-1/ }));
  expect(await screen.findByText("Nenhuma Ordem de Serviço vinculada.")).toBeTruthy();
});
it("não apresenta contagem inválida", async () => {
  resposta.dados = [{ id: "16798001-0000-4000-8000-000000000011", numero: "CH-1", titulo: "Quadro", status_chamado: "aberto", total_os: 1, finalizadas: 2, etapas_mistas: false, vinculo_inconsistente: false }];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><QuadroGerencial usuario="u" cliente="c" /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar Chamados");
  expect(screen.queryByText(/2 de 1/)).toBeNull();
});
it("mantém Chamados consistentes acessíveis e sinaliza vínculo divergente sem mostrar progresso", async () => {
  resposta.dados = [
    { id: "16798001-0000-4000-8000-000000000011", numero: "CH-1", titulo: "Quadro", status_chamado: "aberto", total_os: 1, finalizadas: 0, etapas_mistas: false, vinculo_inconsistente: false },
    { id: "16798001-0000-4000-8000-000000000012", numero: "CH-2", titulo: "Bomba", status_chamado: "aberto", total_os: null, finalizadas: null, etapas_mistas: null, vinculo_inconsistente: true },
  ];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><QuadroGerencial usuario="u" cliente="c" /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Vínculo de OS inconsistente");
  expect(screen.getByRole("button", { name: /Ver OS de CH-1/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Ver OS de CH-2/ })).toBeNull();
  expect(screen.getByText("0 de 1 OS finalizadas")).toBeTruthy();
});
