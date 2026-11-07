// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
import { CriarOrcamento } from "./CriarOrcamento";

const usuario = "17910000-0000-0000-0000-000000000001";
const cliente = "17910000-0000-0000-0000-00000000000a";
const outroCliente = "17910000-0000-0000-0000-00000000000b";
const os = "17910000-0000-0000-0000-000000000011";
const outraOs = "17910000-0000-0000-0000-000000000012";
const listaAlvo = "17910000-0000-0000-0000-000000000201";
const requestId = "17910000-0000-0000-0000-000000000041";
const propostaId = "17910000-0000-0000-0000-000000000051";
const primeiraPagina = Array.from({ length: 100 }, (_, i) => ({
 id: `17910000-0000-0000-0000-${String(i + 100).padStart(12, "0")}`,
 ordem_servico_id: os, responsavel: "cliente", revisao: 1, texto_original: `Lista ${i + 1}`,
}));
function montar(conta = cliente) {
 const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
 return render(<QueryClientProvider client={queryClient}><CriarOrcamento usuario={usuario} cliente={conta} ordemServico={os} /></QueryClientProvider>);
}
beforeEach(() => {
 sessionStorage.clear(); api.rpc.mockReset();
 vi.stubEnv("VITE_SSO_CRIAR_ORCAMENTO_OPERACIONAL_ENABLED", "true");
 vi.stubEnv("VITE_SSO_ORCAMENTO_SEM_OPORTUNIDADE_ENABLED", "true");
 vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
 api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => {
  if (nome === "sso_listar_oportunidades_orcamento") return { abortSignal: async () => ({ data: [], error: null }) };
  if (nome === "sso_listar_listas_materiais_mediada") return { abortSignal: async () => ({ data: args.p_cliente_id === outroCliente ? [] : args.p_apos ? [
   { id: listaAlvo, ordem_servico_id: os, responsavel: "sinergica", revisao: 7, texto_original: "2 tubos específicos" },
  ] : primeiraPagina, error: null }) };
  if (nome === "sso_criar_orcamento_sem_oportunidade") return Promise.resolve({ data: { requestId: args.p_request_id, aggregateId: propostaId, revision: 1, state: "rascunho", linkedIds: { listaId: listaAlvo, ordemServicoId: os } }, error: null });
  throw new Error(`RPC não esperada: ${nome}`);
 });
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("lista de materiais na criação de orçamento", () => {
 it("permite carregar lista elegível após 100 registros e envia a revisão original", async () => {
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Mais listas da OS" }));
  await screen.findByRole("option", { name: /2 tubos específicos/ });
  expect(screen.queryByRole("option", { name: /Outra OS/ })).toBeNull();
  fireEvent.change(screen.getByLabelText("Oportunidade"), { target: { value: "sem-oportunidade" } });
  fireEvent.change(screen.getByLabelText("Lista de materiais"), { target: { value: listaAlvo } });
  expect(screen.getByText("2 tubos específicos")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));
  await waitFor(() => expect(api.rpc).toHaveBeenCalledWith("sso_criar_orcamento_sem_oportunidade", expect.objectContaining({ p_request_id: requestId, p_lista_id: listaAlvo, p_lista_revision: 7 })));
 });

 it("consulta novamente pelo Cliente selecionado e não mantém opções da Conta anterior", async () => {
  const { unmount } = montar();
  fireEvent.click(await screen.findByRole("button", { name: "Mais listas da OS" }));
  await screen.findByRole("option", { name: /2 tubos específicos/ });
  unmount();
  montar(outroCliente);
  await waitFor(() => expect(api.rpc).toHaveBeenCalledWith("sso_listar_listas_materiais_mediada", expect.objectContaining({ p_cliente_id: outroCliente, p_ordem_servico_id: os })));
  expect(screen.queryByRole("option", { name: /2 tubos específicos/ })).toBeNull();
 });

 it("recusa página que mistura outra OS e oculta listas anteriores", async () => {
  api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => {
   if (nome === "sso_listar_oportunidades_orcamento") return { abortSignal: async () => ({ data: [], error: null }) };
   if (nome === "sso_listar_listas_materiais_mediada") return { abortSignal: async () => ({ data: args.p_apos ? [
    { id: listaAlvo, ordem_servico_id: outraOs, responsavel: "sinergica", revisao: 7, texto_original: "Outra OS" },
   ] : primeiraPagina.map((l) => ({ ...l, responsavel: "sinergica" })), error: null }) };
   throw new Error(`RPC não esperada: ${nome}`);
  });
  montar();
  await screen.findByRole("option", { name: /Lista 1 ·/ });
  fireEvent.click(screen.getByRole("button", { name: "Mais listas da OS" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("option", { name: /Lista 1 ·/ })).toBeNull();
  expect(screen.queryByText("Outra OS")).toBeNull();
 });

 it("oculta opções antigas após acesso negado na página seguinte", async () => {
  api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => {
   if (nome === "sso_listar_oportunidades_orcamento") return { abortSignal: async () => ({ data: [], error: null }) };
   if (nome === "sso_listar_listas_materiais_mediada") return { abortSignal: async () => args.p_apos
    ? { data: null, error: { code: "42501" } }
    : { data: primeiraPagina.map((l) => ({ ...l, responsavel: "sinergica" })), error: null } };
   throw new Error(`RPC não esperada: ${nome}`);
  });
  montar();
  await screen.findByRole("option", { name: /Lista 1 ·/ });
  fireEvent.click(screen.getByRole("button", { name: "Mais listas da OS" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("option", { name: /Lista 1 ·/ })).toBeNull();
 });
});
