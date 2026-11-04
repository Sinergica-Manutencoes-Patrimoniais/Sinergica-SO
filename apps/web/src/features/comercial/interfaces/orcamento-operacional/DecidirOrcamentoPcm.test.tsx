// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: "18110000-0000-0000-0000-000000000001" } }, error: null }) } } }));
import { DecidirOrcamentoPcm } from "./DecidirOrcamentoPcm";

const usuario = "18110000-0000-0000-0000-000000000001";
const cliente = "18110000-0000-0000-0000-00000000000a";
const outroCliente = "18110000-0000-0000-0000-00000000000b";
const os = "18110000-0000-0000-0000-000000000011";
const proposta = "18110000-0000-0000-0000-000000000031";
const requestId = "18110000-0000-0000-0000-000000000041";
const chave = (conta: string) => `decisao-pcm-orcamento:${JSON.stringify([usuario, conta, os, proposta])}`;
const tentativa = { requestId, cliente, os, proposta, versao: 1, decisao: "aceita", motivo: "Revisado", evidencia: "Referência declarada" };
const resposta = { requestId, propostaId: proposta, osId: os, versao: 1, decisao: "aceita", evidenciaAutenticada: false, osCriada: false, cobrancaCriada: false };
function montar(conta = cliente, status = "enviada") {
 const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
 return render(<QueryClientProvider client={queryClient}><DecidirOrcamentoPcm usuario={usuario} cliente={conta} os={os} proposta={proposta} versao={1} status={status} /></QueryClientProvider>);
}
beforeEach(() => {
 sessionStorage.clear(); api.rpc.mockReset();
 api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_decisao_pcm_orcamento" ? { abortSignal: async () => ({ data: [], error: null }) } : Promise.resolve({ data: resposta, error: null }));
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); });

describe("decisão PCM distinta do Cliente", () => {
 it("apresenta decisão interna e exige confirmação, motivo e evidência", async () => {
  montar();
  expect(screen.getByText(/não representa aceite direto do Cliente/i)).toBeTruthy();
  const botao = await screen.findByRole("button", { name: "Registrar decisão PCM" });
  expect(botao).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Revisado" } });
  fireEvent.change(screen.getByLabelText("Referência de evidência declarada"), { target: { value: "Referência declarada" } });
  fireEvent.click(screen.getByLabelText(/Confirmo a decisão PCM/));
  expect(botao).toBeEnabled();
 });

 it("repete o request guardado mesmo após status mudar, sem substituí-lo", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(tentativa));
  montar(cliente, "aceita");
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesma tentativa" }));
  await waitFor(() => expect(api.rpc).toHaveBeenCalledWith("sso_decidir_orcamento_pcm", expect.objectContaining({ p_request_id: requestId, p_cliente_id: cliente, p_os_id: os, p_versao: 1 })));
  await waitFor(() => expect(sessionStorage.getItem(chave(cliente))).toBeNull());
  expect(await screen.findByText(/não é aceite direto do Cliente/i)).toBeTruthy();
 });

 it("mantém pedido original quando resultado é incerto", async () => {
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_decisao_pcm_orcamento" ? { abortSignal: async () => ({ data: [], error: null }) } : Promise.resolve({ data: null, error: { message: "falha" } }));
  sessionStorage.setItem(chave(cliente), JSON.stringify(tentativa));
  montar();
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesma tentativa" }));
  expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();
  expect(JSON.parse(sessionStorage.getItem(chave(cliente))!)).toEqual(tentativa);
 });

 it("não recupera pedido de outra Conta", async () => {
  sessionStorage.setItem(chave(cliente), JSON.stringify(tentativa));
  montar(outroCliente);
  await screen.findByRole("button", { name: "Registrar decisão PCM" });
  expect(screen.queryByRole("button", { name: "Repetir mesma tentativa" })).toBeNull();
  expect(sessionStorage.getItem(chave(cliente))).not.toBeNull();
  expect(api.rpc).toHaveBeenCalledWith("sso_consultar_decisao_pcm_orcamento", expect.objectContaining({ p_cliente_id: outroCliente }));
 });
});
