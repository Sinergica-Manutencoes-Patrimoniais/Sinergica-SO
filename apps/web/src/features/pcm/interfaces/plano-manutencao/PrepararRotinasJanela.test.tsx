// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) }, schema: () => ({ rpc: api.rpc }) } }));
vi.mock("../../infrastructure/supabase-snapshot-exportacao", () => ({ obterPaginaSnapshotExportacao: vi.fn() }));
vi.mock("../../application/snapshot-exportacao", () => ({ lerSnapshotExportacao: async () => ({ snapshotHash: "fixture", rotinas: [
  { id: "16610000-0000-4000-8000-000000000001", nome: "Rotina A", modo: "calendario", alvoTipo: "sistema", alvoId: "16610000-0000-4000-8000-000000000011", alvoNome: "Sistema A" },
  { id: "16610000-0000-4000-8000-000000000002", nome: "Rotina B", modo: "calendario", alvoTipo: "sistema", alvoId: "16610000-0000-4000-8000-000000000012", alvoNome: "Sistema B" },
  { id: "16610000-0000-4000-8000-000000000003", nome: "Visita", modo: "visita", alvoTipo: "sistema", alvoId: "16610000-0000-4000-8000-000000000013", alvoNome: "Sistema C" },
] }), confirmarSnapshotExportacao: async () => {} }));
vi.mock("./FilaAposPreparacao", () => ({ FilaAposPreparacao: () => null }));
import { PrepararRotinasJanela } from "./PrepararRotinasJanela";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function montar() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><PrepararRotinasJanela userId="usuario" clienteId={id(21)} planoId={id(22)} versaoId={id(23)} revision={1} /></QueryClientProvider>); }
async function selecionar() { fireEvent.change(screen.getByLabelText("Início da janela"), { target: { value: "2026-11-01" } }); fireEvent.change(screen.getByLabelText("Fim da janela"), { target: { value: "2026-11-30" } }); fireEvent.click(await screen.findByRole("checkbox", { name: /Rotina A/ })); fireEvent.click(screen.getByRole("checkbox", { name: /Rotina B/ })); fireEvent.click(screen.getByRole("button", { name: "Conferir Rotinas e origens" })); }
beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.resetAllMocks(); sessionStorage.clear(); });

it("prepara Rotinas sequencialmente e retoma o pedido da Rotina incerta", async () => {
  let materializacoes = 0;
  api.rpc.mockImplementation(async (nome, p) => {
    if (nome === "sso_origens_lote_calendario") return { data: { revisao: 1, inicio: p.p_inicio, fim: p.p_fim, itens: [{ ciclo: 0, vencimento: "2026-11-10", estado: "plano", agendamentoId: null }], fontesCompletas: false, exclusividadeGlobalComprovada: false }, error: null };
    materializacoes++;
    if (materializacoes === 2) return { data: null, error: new Error("rede") };
    return { data: { requestId: p.p_request_id, inicio: p.p_inicio, fim: p.p_fim, total: 1, criadas: 1, itens: [{ indice: 0, vencimentoOriginal: "2026-11-10", preparadaId: p.p_rotina_id === id(1) ? id(31) : id(32), cicloCanonicoId: p.p_rotina_id === id(1) ? id(41) : id(42), criada: true }], atomico: true, osCriada: false, tarefaAuvoCriada: false }, error: null };
  });
  montar(); await screen.findByRole("checkbox", { name: /Rotina A/ }); await selecionar();
  fireEvent.click(await screen.findByRole("checkbox", { name: /autorizo a preparação sequencial/i }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar Rotinas selecionadas" }));
  expect(await screen.findByText(/Sequência interrompida após 1 de 2/)).toBeInTheDocument();
  const tentativas = () => api.rpc.mock.calls.filter(([nome]) => nome === "sso_materializar_lote_calendario_origem_conferida");
  const pendente = tentativas()[1]![1];
  fireEvent.click(screen.getByRole("button", { name: "Retomar sequência" }));
  await waitFor(() => expect(screen.getByText(/Preparação concluída/)).toBeInTheDocument());
  expect(tentativas()[2]![1]).toEqual(pendente);
  expect(screen.getByLabelText("Ocorrências preparadas na janela")).toHaveTextContent(id(31));
  expect(screen.getByLabelText("Ocorrências preparadas na janela")).toHaveTextContent(id(32));
  expect(api.rpc.mock.calls.filter(([nome]) => nome === "sso_alterar_fila_preventiva_pcm")).toHaveLength(0);
});

it("bloqueia a preparação quando uma Rotina exige conferência de PMOC", async () => {
  api.rpc.mockImplementation(async (_nome, p) => ({ data: { revisao: 1, inicio: p.p_inicio, fim: p.p_fim, itens: [{ ciclo: 0, vencimento: "2026-11-10", estado: p.p_rotina_id === id(1) ? "plano" : "pmoc_pendente", agendamentoId: null }], fontesCompletas: false, exclusividadeGlobalComprovada: false }, error: null }));
  montar(); await screen.findByRole("checkbox", { name: /Rotina A/ }); await selecionar();
  expect(await screen.findByRole("alert")).toHaveTextContent("origem PMOC");
  expect(screen.getByRole("button", { name: "Preparar Rotinas selecionadas" })).toBeDisabled();
  expect(api.rpc).toHaveBeenCalledTimes(2);
});
