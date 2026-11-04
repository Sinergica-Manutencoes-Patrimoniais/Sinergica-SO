// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const externo = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: externo.rpc }), auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
import { DividirComposicao } from "./DividirComposicao";
import { PromoverComposicao } from "./PromoverComposicao";

const cliente = "17400000-0000-4000-8000-000000000020";
const outro = "17400000-0000-4000-8000-000000000021";
const composicao = "17400000-0000-4000-8000-000000000030";
const p1 = "17400000-0000-4000-8000-000000000070";
const p2 = "17400000-0000-4000-8000-000000000071";
const q = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function lista() {
  externo.rpc.mockImplementation((nome: string) => nome === "sso_listar_pendencias_sem_parcela" ? { abortSignal: async () => ({ error: null, data: [
    { pendencia_id: p1, pergunta: "p1", estado: "aberta", revisao_atual: 1, revisao_origem: 1, situacao: "sem_parcela" },
    { pendencia_id: p2, pergunta: "p2", estado: "aberta", revisao_atual: 1, revisao_origem: 1, situacao: "sem_parcela" },
  ] }) } : Promise.resolve({ data: null, error: { code: "42501" } }));
}
function dividir(qc: QueryClient, clienteId = cliente) { return <QueryClientProvider client={qc}><DividirComposicao userId="usuario" clienteId={clienteId} composicaoId={composicao} revisao={3} total={2} onDividida={() => {}} /></QueryClientProvider>; }
function promover(qc: QueryClient, clienteId = cliente) { return <QueryClientProvider client={qc}><PromoverComposicao userId="usuario" clienteId={clienteId} composicaoId={composicao} revisao={3} total={2} /></QueryClientProvider>; }
afterEach(() => { cleanup(); vi.resetAllMocks(); sessionStorage.clear(); });

it("não divide o escopo inteiro", async () => {
  lista(); render(dividir(q()));
  fireEvent.click(await screen.findByRole("checkbox", { name: /pergunta p1/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: /pergunta p2/i }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Separar" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmo a divisão/i }));
  expect(screen.getByRole("button", { name: "Separar seleção" })).toBeDisabled();
  expect(externo.rpc.mock.calls.filter(([nome]) => nome === "sso_dividir_composicao_backlog")).toHaveLength(0);
});

it("reenvia divisão incerta com Cliente, revisão e seleção originais", async () => {
  lista(); render(dividir(q()));
  fireEvent.click(await screen.findByRole("checkbox", { name: /pergunta p1/i }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Separar" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmo a divisão/i }));
  fireEvent.click(screen.getByRole("button", { name: "Separar seleção" }));
  const retry = await screen.findByRole("button", { name: "Repetir tentativa de divisão" });
  await waitFor(() => expect(retry).toBeEnabled()); fireEvent.click(retry);
  await waitFor(() => expect(externo.rpc.mock.calls.filter(([nome]) => nome === "sso_dividir_composicao_backlog")).toHaveLength(2));
  const chamadas = externo.rpc.mock.calls.filter(([nome]) => nome === "sso_dividir_composicao_backlog");
  expect(chamadas[0]?.[1]).toMatchObject({ p_cliente_id: cliente, p_origem_id: composicao, p_expected_revision: 3, p_itens: [p1] });
  expect(chamadas[1]?.[1]).toEqual(chamadas[0]?.[1]);
});

it("reenvia promoção integral incerta sem trocar Cliente ou revisão", async () => {
  lista(); render(promover(q()));
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Corrigir" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmo promoção integral/i }));
  fireEvent.click(screen.getByRole("button", { name: "Criar Chamado" }));
  const retry = await screen.findByRole("button", { name: "Repetir tentativa de promoção" });
  await waitFor(() => expect(retry).toBeEnabled()); fireEvent.click(retry);
  await waitFor(() => expect(externo.rpc.mock.calls.filter(([nome]) => nome === "sso_promover_backlog_chamado")).toHaveLength(2));
  const chamadas = externo.rpc.mock.calls.filter(([nome]) => nome === "sso_promover_backlog_chamado");
  expect(chamadas[0]?.[1]).toMatchObject({ p_cliente_id: cliente, p_composicao_id: composicao, p_expected_revision: 3, p_titulo: "Corrigir" });
  expect(chamadas[1]?.[1]).toEqual(chamadas[0]?.[1]);
  expect(screen.getByText(/nenhuma OS ou tarefa Auvo será criada/i)).toBeTruthy();
});

it("não recupera pedido de outro Cliente ao remontar a promoção", async () => {
  lista(); const tela = render(promover(q()));
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Corrigir" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmo promoção integral/i }));
  fireEvent.click(screen.getByRole("button", { name: "Criar Chamado" }));
  await screen.findByRole("button", { name: "Repetir tentativa de promoção" });
  tela.unmount(); render(promover(q(), outro));
  expect(screen.queryByRole("button", { name: "Repetir tentativa de promoção" })).toBeNull();
  expect(screen.getByLabelText("Título")).toHaveValue("");
});
