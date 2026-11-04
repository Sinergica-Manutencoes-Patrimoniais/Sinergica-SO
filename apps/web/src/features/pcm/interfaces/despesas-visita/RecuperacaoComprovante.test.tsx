// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), realizar: vi.fn(), rpc: vi.fn() }));
vi.mock("../../infrastructure/supabase-despesas-visita-adapter", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../infrastructure/supabase-despesas-visita-adapter")>();
  return { ...original, enviarComprovanteDespesa: mocks.upload, realizarDespesa: mocks.realizar };
});
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: mocks.rpc }), auth: { getUser: async () => ({ data: { user: { id: "18010000-0000-0000-0000-000000000001" } }, error: null }) } } }));
import { RealizarDespesa } from "./RealizarDespesa";
import { CorrigirValorComprovante } from "./CorrigirValorComprovante";

const userId = "18010000-0000-0000-0000-000000000001";
const clienteId = "18010000-0000-0000-0000-00000000000a";
const visitaId = "18010000-0000-0000-0000-000000000021";
const despesaId = "18010000-0000-0000-0000-000000000051";
const requestId = "18010000-0000-0000-0000-000000000061";
const objetoId = "18010000-0000-0000-0000-000000000071";
const nonce = "18010000-0000-0000-0000-000000000081";
const prefixo = `${userId}:${clienteId}:${visitaId}:${despesaId}`;
const despesa = { id: despesaId, descricao: "Deslocamento", data: "2026-11-01", previstoCentavos: 12000, realizadoCentavos: null, status: "ativa" as const, revisao: 7 };
const realizado = { ...despesa, realizadoCentavos: 10000 };
function montar(elemento: ReactElement) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>);
}
const props = { userId, clienteId, visitaId };
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("VITE_SSO_REALIZAR_DESPESAS_VISITA_ENABLED", "true");
  vi.stubEnv("VITE_SSO_CORRIGIR_COMPROVANTE_DESPESA_ENABLED", "true");
  mocks.upload.mockReset(); mocks.realizar.mockReset(); mocks.rpc.mockReset();
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllEnvs(); });

describe("recuperação de comprovantes de despesa", () => {
  it("não escolhe protocolo por inferência quando o marcador está ausente", async () => {
    const pedido = { requestId, despesaId, visitaId, expectedRevision: 7, realizadoCentavos: 10000, comprovanteObjetoId: objetoId };
    const chave = `sso-realizacao-despesa:${prefixo}`;
    sessionStorage.setItem(chave, JSON.stringify(pedido));
    montar(<RealizarDespesa {...props} despesa={despesa} />);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
    await screen.findByText(/Resultado não confirmado/);
    expect(mocks.realizar).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  });
  it("bloqueia upload anterior incerto sem associar objeto ou iniciar nova tentativa", () => {
    sessionStorage.setItem(`sso-upload-despesa:${prefixo}`, JSON.stringify({ requestId, clienteId, visitaId, despesaId, expectedRevision: 7, realizadoCentavos: 10000, caminho: `${clienteId}/${despesaId}/${nonce}`, hash: "a".repeat(64), tipo: "application/pdf", tamanho: 10 }));
    montar(<RealizarDespesa {...props} despesa={despesa} />);
    expect(screen.getByText(/Recuperação bloqueada até verificar a integridade/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Registrar realização" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.realizar).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(`sso-upload-despesa:${prefixo}`)).not.toBeNull();
  });

  it("repete pedido de realização já persistido com a mesma identidade após resposta incerta", async () => {
    const pedido = { requestId, despesaId, visitaId, expectedRevision: 7, realizadoCentavos: 10000, comprovanteObjetoId: objetoId };
    sessionStorage.setItem(`sso-realizacao-despesa:${prefixo}`, JSON.stringify(pedido));
    sessionStorage.setItem(`sso-realizacao-despesa-modo:${prefixo}`, JSON.stringify({ requestId, modo: "legado" }));
    mocks.realizar.mockRejectedValueOnce(new Error("incerto")).mockResolvedValueOnce({});
    montar(<RealizarDespesa {...props} despesa={despesa} />);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
    await screen.findByText(/Resultado não confirmado/);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
    await waitFor(() => expect(mocks.realizar).toHaveBeenCalledTimes(2));
    expect(mocks.realizar.mock.calls[0]?.[0]).toEqual(pedido);
    expect(mocks.realizar.mock.calls[1]?.[0]).toEqual(pedido);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("mantém o pedido quando a autorização é revogada e não envia outro upload", async () => {
    const pedido = { requestId, despesaId, visitaId, expectedRevision: 7, realizadoCentavos: 10000, comprovanteObjetoId: objetoId };
    const chave = `sso-realizacao-despesa:${prefixo}`;
    sessionStorage.setItem(chave, JSON.stringify(pedido));
    sessionStorage.setItem(`sso-realizacao-despesa-modo:${prefixo}`, JSON.stringify({ requestId, modo: "legado" }));
    mocks.realizar.mockRejectedValueOnce(new Error("acesso revogado"));
    montar(<RealizarDespesa {...props} despesa={despesa} />);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
    await screen.findByText(/Resultado não confirmado/);
    expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
    expect(mocks.realizar).toHaveBeenCalledWith(pedido, "legado");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Registrar realização" })).toBeNull();
  });

  it("repetição mediada preserva o comando e não escolhe a rota legada", async () => {
    vi.stubEnv("VITE_SSO_INGESTAO_COMPROVANTE_ENABLED", "true");
    const pedido = { requestId, despesaId, visitaId, expectedRevision: 7, realizadoCentavos: 10000, comprovanteObjetoId: objetoId };
    sessionStorage.setItem(`sso-realizacao-despesa:${prefixo}`, JSON.stringify(pedido));
    sessionStorage.setItem(`sso-realizacao-despesa-modo:${prefixo}`, JSON.stringify({ requestId, modo: "mediado" }));
    sessionStorage.setItem(`sso-upload-despesa:${prefixo}`, JSON.stringify({ requestId, clienteId, visitaId, despesaId, expectedRevision: 7, realizadoCentavos: 10000, caminho: `${clienteId}/${despesaId}/${requestId}`, hash: "a".repeat(64), tipo: "application/pdf", tamanho: 10, modo: "mediado" }));
    mocks.realizar.mockResolvedValueOnce({});
    montar(<RealizarDespesa {...props} despesa={despesa} />);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
    await waitFor(() => expect(mocks.realizar).toHaveBeenCalledWith(pedido, "mediado"));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("não reenvia realização mediada se a flag foi desligada", async () => {
    const pedido = { requestId, despesaId, visitaId, expectedRevision: 7, realizadoCentavos: 10000, comprovanteObjetoId: objetoId };
    sessionStorage.setItem(`sso-realizacao-despesa:${prefixo}`, JSON.stringify(pedido));
    sessionStorage.setItem(`sso-realizacao-despesa-modo:${prefixo}`, JSON.stringify({ requestId, modo: "mediado" }));
    sessionStorage.setItem(`sso-upload-despesa:${prefixo}`, JSON.stringify({ requestId, clienteId, visitaId, despesaId, expectedRevision: 7, realizadoCentavos: 10000, caminho: `${clienteId}/${despesaId}/${requestId}`, hash: "a".repeat(64), tipo: "application/pdf", tamanho: 10, modo: "mediado" }));
    montar(<RealizarDespesa {...props} despesa={despesa} />);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
    await screen.findByText(/Resultado não confirmado/);
    expect(mocks.realizar).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(`sso-realizacao-despesa:${prefixo}`)).not.toBeNull();
  });

  it("não recupera a tentativa guardada por outra sessão de usuário", () => {
    const pedido = { requestId, despesaId, visitaId, expectedRevision: 7, realizadoCentavos: 10000, comprovanteObjetoId: objetoId };
    sessionStorage.setItem(`sso-realizacao-despesa:${prefixo}`, JSON.stringify(pedido));
    montar(<RealizarDespesa {...props} userId="18010000-0000-0000-0000-000000000002" despesa={despesa} />);
    expect(screen.queryByRole("button", { name: "Repetir tentativa" })).toBeNull();
    expect(mocks.realizar).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(`sso-realizacao-despesa:${prefixo}`)).toBe(JSON.stringify(pedido));
  });

  it("bloqueia correção com upload incerto sem apagar marcador nem associar objeto", () => {
    const chave = `sso-corrigir-comprovante-upload:${prefixo}`;
    sessionStorage.setItem(chave, JSON.stringify({ requestId }));
    montar(<CorrigirValorComprovante {...props} despesa={realizado} />);
    expect(screen.getByText(/Upload pendente sem prova de integridade/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Registrar correção" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(chave)).not.toBeNull();
  });

  it("repete correção persistida com o mesmo request e só então limpa marcador correspondente", async () => {
    const pedido = { requestId, despesaId, visitaId, expectedRevision: 7, valorCentavos: 10000, comprovanteObjetoId: objetoId, motivo: "Correção", conferencia: "Conferido" };
    const chaveUpload = `sso-corrigir-comprovante-upload:${prefixo}`;
    sessionStorage.setItem(chaveUpload, JSON.stringify({ requestId }));
    sessionStorage.setItem(`sso-corrigir-comprovante:${prefixo}`, JSON.stringify(pedido));
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("incerto") }).mockResolvedValueOnce({ data: { requestId, aggregateId: despesaId, revision: 8, state: "ativa", linkedIds: { visitaId } }, error: null });
    montar(<CorrigirValorComprovante {...props} despesa={realizado} />);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
    await screen.findByText(/Resultado não confirmado/);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa" }));
    await waitFor(() => expect(sessionStorage.getItem(chaveUpload)).toBeNull());
    expect(mocks.rpc.mock.calls[0]?.[1]).toEqual(mocks.rpc.mock.calls[1]?.[1]);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
