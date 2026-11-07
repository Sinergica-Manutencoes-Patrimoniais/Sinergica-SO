// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResolverConflitoWebhook } from "./ResolverConflitoWebhook";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc }) } }));
afterEach(() => { cleanup(); sessionStorage.clear(); rpc.mockReset(); });
it("exige atestado antes de registrar decisão e informa que não atua no Auvo", async () => {
  rpc.mockImplementation(async (_nome, args) => ({ data: { requestId: args.p_request_id, conflitoId: args.p_conflito_id, conferenciaRemotaAtestada: true }, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ResolverConflitoWebhook usuario="u" cliente="c" os="o" conflito="x" statusRemoto="em_execucao" statusAtual="em_execucao" taskId="123" taskAtual="123" atualizadoEm="2026-10-30T00:00:00Z" /></QueryClientProvider>);
  expect(screen.getByRole("button", { name: "Registrar resolução" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar resolução" }));
  expect(await screen.findByText(/resolução registrada/i)).toHaveTextContent("Nenhuma ação no Auvo");
  expect(rpc).toHaveBeenCalledWith("sso_resolver_conflito_webhook_chamado", expect.objectContaining({ p_conferiu_remoto: true, p_conflito_id: "x" }));
  await waitFor(() => expect(sessionStorage.length).toBe(0));
});
it("impede decisão enquanto status observado diverge", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ResolverConflitoWebhook usuario="u" cliente="c" os="o" conflito="x" statusRemoto="em_execucao" statusAtual="finalizado" taskId="123" taskAtual="123" atualizadoEm="2026-10-30T00:00:00Z" /></QueryClientProvider>);
  expect(screen.getByText(/status ainda divergente/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Registrar resolução" })).toBeNull();
  expect(rpc).not.toHaveBeenCalled();
});
it("resultado incerto permite repetir o mesmo requestId", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: new Error("timeout") });
  rpc.mockImplementationOnce(async (_nome, args) => ({ data: { requestId: args.p_request_id, conflitoId: args.p_conflito_id, conferenciaRemotaAtestada: true }, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ResolverConflitoWebhook usuario="u" cliente="c" os="o" conflito="x" statusRemoto="em_execucao" statusAtual="em_execucao" taskId="123" taskAtual="123" atualizadoEm="2026-10-30T00:00:00Z" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar resolução" }));
  expect(await screen.findByText(/resultado não confirmado/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesma decisão" }));
  expect(await screen.findByText(/resolução registrada/i)).toBeTruthy();
  expect(rpc.mock.calls[0]?.[1].p_request_id).toBe(rpc.mock.calls[1]?.[1].p_request_id);
});

it("não repete decisão se outra instância mudou a tentativa local", async () => {
  rpc.mockResolvedValue({ data: null, error: new Error("timeout") });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ResolverConflitoWebhook usuario="u" cliente="c" os="o" conflito="x" statusRemoto="em_execucao" statusAtual="em_execucao" taskId="123" taskAtual="123" atualizadoEm="2026-10-30T00:00:00Z" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar resolução" }));
  expect(await screen.findByText(/resultado não confirmado/i)).toBeInTheDocument();
  const chave = `sso-resolucao-webhook:${JSON.stringify(["u", "c", "o", "x"])}`;
  sessionStorage.setItem(chave, "outra tentativa");
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesma decisão" }));
  await act(async () => {});
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});

it("não apaga outra tentativa quando a decisão anterior confirma", async () => {
  let resolver!: (value: object) => void;
  rpc.mockImplementation((_nome, args) => new Promise((resolve) => { resolver = () => resolve({ data: { requestId: args.p_request_id, conflitoId: args.p_conflito_id, conferenciaRemotaAtestada: true }, error: null }); }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ResolverConflitoWebhook usuario="u" cliente="c" os="o" conflito="x" statusRemoto="em_execucao" statusAtual="em_execucao" taskId="123" taskAtual="123" atualizadoEm="2026-10-30T00:00:00Z" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Registrar resolução" }));
  await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
  const chave = `sso-resolucao-webhook:${JSON.stringify(["u", "c", "o", "x"])}`;
  sessionStorage.setItem(chave, "outra tentativa");
  await act(async () => resolver({}));
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});
