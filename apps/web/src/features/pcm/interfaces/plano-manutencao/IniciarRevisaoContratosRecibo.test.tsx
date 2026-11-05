// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) } }));
import { IniciarRevisaoContratos } from "./IniciarRevisaoContratos";
const id = (n: number) => `16500000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const usuario=id(1), clienteId=id(2), planoId=id(3), versaoId=id(4), requestId=id(5);
const chave = `sso-revisao-contratos:${JSON.stringify([usuario, clienteId, planoId])}`;
const auth = () => ({ data: { user: { id: usuario } }, error: null });
const recibo = { requestId, aggregateId: planoId, revision: 5, state: "rascunho", created: true, linkedIds: { clienteId, versaoId }, contratosCopiados: 2, itensNaoCopiados: 1, evidenciasCopiadas: 1, evidenciasNaoCopiadas: 0, exigenciasPropostas: 1, exigenciasNaoCopiadas: 0, reconferenciaNecessaria: true, reconferenciaExigenciasNecessaria: true };
beforeEach(() => { vi.resetAllMocks(); sessionStorage.clear(); api.getUser.mockResolvedValue(auth()); vi.stubEnv("VITE_SSO_REVISAO_CONTRATOS_MEDIADA_ENABLED", "true"); vi.stubEnv("VITE_SSO_REVISAO_COM_EVIDENCIAS_ENABLED", "false"); vi.stubEnv("VITE_SSO_REVISAO_COM_EXIGENCIAS_ENABLED", "false"); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); });
it.each(["contratos", "evidencias", "exigencias"] as const)("preserva pedido e repete recibo divergente no modo %s", async (modo) => {
  if (modo === "evidencias") vi.stubEnv("VITE_SSO_REVISAO_COM_EVIDENCIAS_ENABLED", "true");
  if (modo === "exigencias") vi.stubEnv("VITE_SSO_REVISAO_COM_EXIGENCIAS_ENABLED", "true");
  const pedido = { requestId, clienteId, planoId, revision: 2, versaoId, modo }; const salvo = JSON.stringify(pedido); sessionStorage.setItem(chave, salvo);
  api.rpc.mockResolvedValueOnce({ data: { ...recibo, linkedIds: { clienteId, versaoId: id(9) } }, error: null }).mockResolvedValueOnce({ data: recibo, error: null });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><IniciarRevisaoContratos userId={usuario} clienteId={clienteId} planoId={planoId} revision={2} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(chave)).toBe(salvo);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
  expect(api.rpc.mock.calls[1]).toEqual(api.rpc.mock.calls[0]);
  expect(api.rpc.mock.calls[0]).toEqual(["sso_iniciar_revisao_contratos_mediada", {
    p_ator: usuario, p_cliente: clienteId, p_plano: planoId, p_request: requestId,
    p_expected_revision: 2, p_nova_versao: versaoId, p_modo: modo,
  }]);
  expect(await screen.findByText(/Revisão iniciada/)).toBeTruthy();
});
it("sessão alterada após escrita mantém revisão pendente", async () => {
  const pedido = { requestId, clienteId, planoId, revision: 2, versaoId, modo: "contratos" }; const salvo = JSON.stringify(pedido); sessionStorage.setItem(chave, salvo);
  api.rpc.mockImplementationOnce(async () => { api.getUser.mockResolvedValue({ data: { user: { id: id(9) } }, error: null }); return { data: recibo, error: null }; });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><IniciarRevisaoContratos userId={usuario} clienteId={clienteId} planoId={planoId} revision={2} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/tentativa local mudou ou não pôde ser removida/i);
  expect(sessionStorage.getItem(chave)).toBe(salvo);
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
});

it("rascunho permite recuperar pedido mas não iniciar revisão nova", async () => {
  const pedido = { requestId, clienteId, planoId, revision: 2, versaoId, modo: "contratos" }; sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockResolvedValueOnce({ data: recibo, error: null });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><IniciarRevisaoContratos userId={usuario} clienteId={clienteId} planoId={planoId} revision={5} permitirNova={false} /></QueryClientProvider>);
  expect(screen.getByRole("button", { name: "Iniciar revisão com contratos" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
  expect(api.rpc).toHaveBeenCalledWith("sso_iniciar_revisao_contratos_mediada", expect.objectContaining({ p_request: requestId, p_expected_revision: 2, p_nova_versao: versaoId }));
});
it("flag desligada conserva tentativa sem enviar", () => {
  vi.stubEnv("VITE_SSO_REVISAO_CONTRATOS_MEDIADA_ENABLED", "false");
  const pedido = { requestId, clienteId, planoId, revision: 2, versaoId, modo: "contratos" }; const salvo = JSON.stringify(pedido); sessionStorage.setItem(chave, salvo);
  render(<QueryClientProvider client={new QueryClient()}><IniciarRevisaoContratos userId={usuario} clienteId={clienteId} planoId={planoId} revision={5} permitirNova={false} /></QueryClientProvider>);
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeDisabled();
  expect(sessionStorage.getItem(chave)).toBe(salvo); expect(api.rpc).not.toHaveBeenCalled();
});
