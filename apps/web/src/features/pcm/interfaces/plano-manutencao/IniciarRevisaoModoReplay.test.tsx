// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IniciarRevisaoContratos } from "./IniciarRevisaoContratos";

const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) } }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const userId = id(1), clienteId = id(2), planoId = id(3), versaoId = id(4), requestId = id(5);
const pedido = { requestId, clienteId, planoId, revision: 4, versaoId, modo: "contratos" };
const chave = `sso-revisao-contratos:${JSON.stringify([userId, clienteId, planoId])}`;
function montar() {
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><IniciarRevisaoContratos userId={userId} clienteId={clienteId} planoId={planoId} revision={5} permitirNova={false} /></QueryClientProvider>);
}
beforeEach(() => {
  sessionStorage.clear(); vi.resetAllMocks();
  vi.stubEnv("VITE_SSO_REVISAO_CONTRATOS_MEDIADA_ENABLED", "true");
  vi.stubEnv("VITE_SSO_REVISAO_COM_EVIDENCIAS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_REVISAO_COM_EXIGENCIAS_ENABLED", "false");
  api.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); sessionStorage.clear(); });
it("consulta apenas o recibo do modo guardado quando a configuração mudou", async () => {
  api.rpc.mockResolvedValue({ data: { requestId, aggregateId: planoId, revision: 5, state: "rascunho", created: true, linkedIds: { clienteId, versaoId }, contratosCopiados: 0, itensNaoCopiados: 0, reconferenciaNecessaria: true }, error: null });
  montar();
  expect(screen.getByText(/Esta tentativa será apenas consultada/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
  expect(api.rpc).toHaveBeenCalledTimes(1);
  expect(api.rpc).toHaveBeenCalledWith("sso_consultar_recibo_revisao_contratos", { p_ator: userId, p_cliente: clienteId, p_plano: planoId, p_request: requestId, p_expected_revision: 4, p_nova_versao: versaoId, p_modo: "contratos" });
});
it("preserva a tentativa quando o gate da consulta do modo anterior nega", async () => {
  api.rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
  montar(); fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(api.rpc).toHaveBeenCalledWith("sso_consultar_recibo_revisao_contratos", expect.objectContaining({ p_request: requestId, p_modo: "contratos" }));
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
});

it("não inicia revisão se consulta do modo anterior não encontra recibo", async () => {
  api.rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
  montar(); fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(api.rpc).toHaveBeenCalledTimes(1);
  expect(api.rpc).toHaveBeenCalledWith("sso_consultar_recibo_revisao_contratos", expect.objectContaining({ p_request: requestId, p_modo: "contratos" }));
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
});

it("preserva tentativa quando gate de envio do mesmo modo nega", async () => {
  vi.stubEnv("VITE_SSO_REVISAO_COM_EVIDENCIAS_ENABLED", "false");
  api.rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
  montar(); fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(api.rpc).toHaveBeenCalledTimes(1);
  expect(api.rpc).toHaveBeenCalledWith("sso_iniciar_revisao_contratos_mediada", expect.objectContaining({ p_request: requestId, p_modo: "contratos" }));
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
});
