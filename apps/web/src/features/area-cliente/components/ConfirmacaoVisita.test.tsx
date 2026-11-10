// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
import { ConfirmacaoVisita } from "./ConfirmacaoVisita";
const userId = "18390000-0000-4000-8000-000000000001";
const clienteId = "18390000-0000-4000-8000-000000000002";
const osId = "18390000-0000-4000-8000-000000000003";
const publicacaoId = "18390000-0000-4000-8000-000000000004";
const requestId = "18390000-0000-4000-8000-000000000005";
const chave = `sso-confirmacao-cliente:${JSON.stringify([userId, clienteId, osId, publicacaoId])}`;
afterEach(() => { cleanup(); sessionStorage.clear(); api.rpc.mockReset(); });

it("não confirma nem apaga tentativa quando RPC devolve data inválida", async () => {
  const pedido = { requestId, publicacaoId }; sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockImplementation((nome: string) => nome === "sso_portal_status_confirmacao_visita"
    ? { abortSignal: async () => ({ data: "pendente", error: null }) }
    : Promise.resolve({ data: "resposta-inválida", error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ConfirmacaoVisita userId={userId} clienteId={clienteId} osId={osId} publicacaoId={publicacaoId} /></QueryClientProvider>);
  await screen.findByText(/Esta programação exige confirmação/);
  fireEvent.click(screen.getByRole("button", { name: "Repetir confirmação" }));
  expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  expect(screen.queryByText(/Confirmação registrada; a equipe/)).toBeNull();
});

it("aceita confirmação com timestamp válido e limpa somente o pedido correspondente", async () => {
  sessionStorage.setItem(chave, JSON.stringify({ requestId, publicacaoId }));
  api.rpc.mockImplementation((nome: string) => nome === "sso_portal_status_confirmacao_visita"
    ? { abortSignal: async () => ({ data: "pendente", error: null }) }
    : Promise.resolve({ data: "2026-10-30T10:00:00+00:00", error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ConfirmacaoVisita userId={userId} clienteId={clienteId} osId={osId} publicacaoId={publicacaoId} /></QueryClientProvider>);
  await screen.findByText(/Esta programação exige confirmação/);
  fireEvent.click(screen.getByRole("button", { name: "Repetir confirmação" }));
  expect(await screen.findByText(/Confirmação registrada; a equipe/)).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBeNull();
});
