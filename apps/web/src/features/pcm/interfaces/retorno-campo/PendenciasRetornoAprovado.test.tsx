// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const externo = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: externo.rpc }), auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
import { PendenciasRetornoAprovado } from "./PendenciasRetornoAprovado";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it("atualiza a lista do Cliente após preparar Pendências no servidor, sem invalidar outro Cliente", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const chave = ["pendencias-tecnicas", "u", "c", "lista"];
  const outra = ["pendencias-tecnicas", "u", "outro", "lista"];
  client.setQueryData(chave, { pages: [[]], pageParams: [null] });
  client.setQueryData(outra, { pages: [[]], pageParams: [null] });
  externo.rpc.mockImplementation((nome: string, p: { p_request_id?: string }) => {
    if (nome === "sso_preparar_pendencias_retorno_mediado") return Promise.resolve({ data: { requestId: p.p_request_id, retornoId: "retorno", pendenciasProcessadas: 2, osEncerrada: false }, error: null });
    if (!["sso_listar_condicoes_retorno_mediado", "sso_listar_decisoes_retorno_mediado"].includes(nome)) throw new Error("Consulta não mediada");
    const data = nome === "sso_listar_condicoes_retorno_mediado"
      ? [{ id: "condicao", revisao_evidencias: 1, revisao_decisao: 1, criado_em: "2026-10-30T12:00:00Z" }]
      : [{ revisao: 2, decisao: "aprovar", motivo: null, ator_id: "ator", criado_em: "2026-10-30T12:00:00Z" }];
    return { abortSignal: async () => ({ data, error: null }) };
  });
  render(<QueryClientProvider client={client}><PendenciasRetornoAprovado userId="u" clienteId="c" retornoId="retorno" /></QueryClientProvider>);
  await screen.findByRole("option", { name: /condicao/ });
  fireEvent.change(screen.getByLabelText("Condição estrutural"), { target: { value: "condicao" } });
  fireEvent.click(await screen.findByRole("checkbox", { name: /Conferi o retorno/ }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar pendências" }));
  await screen.findByText(/2 resposta\(s\) Não OK processada/);
  await waitFor(() => expect(client.getQueryState(chave)?.isInvalidated).toBe(true));
  expect(client.getQueryState(outra)?.isInvalidated).toBe(false);
});

it("invalida Pendências mesmo quando a tentativa concluída não pode ser removida", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const chave = ["pendencias-tecnicas", "u", "c", "lista"];
  client.setQueryData(chave, { pages: [[]], pageParams: [null] });
  externo.rpc.mockImplementation((nome: string, p: { p_request_id?: string }) => nome === "sso_preparar_pendencias_retorno_mediado"
    ? Promise.resolve({ data: { requestId: p.p_request_id, retornoId: "retorno", pendenciasProcessadas: 1, osEncerrada: false }, error: null })
    : { abortSignal: async () => { if (!["sso_listar_condicoes_retorno_mediado", "sso_listar_decisoes_retorno_mediado"].includes(nome)) throw new Error("Consulta não mediada"); return { data: nome === "sso_listar_condicoes_retorno_mediado" ? [{ id: "condicao", revisao_evidencias: 1, revisao_decisao: 1, criado_em: "2026-10-30T12:00:00Z" }] : [{ revisao: 2, decisao: "aprovar", motivo: null, ator_id: "ator", criado_em: "2026-10-30T12:00:00Z" }], error: null }; } });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementationOnce(() => { throw new Error("sem acesso"); });
  render(<QueryClientProvider client={client}><PendenciasRetornoAprovado userId="u" clienteId="c" retornoId="retorno" /></QueryClientProvider>);
  await screen.findByRole("option", { name: /condicao/ });
  fireEvent.change(screen.getByLabelText("Condição estrutural"), { target: { value: "condicao" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi o retorno/ }));
  fireEvent.click(screen.getByRole("button", { name: "Preparar pendências" }));
  await screen.findByText(/tentativa local mudou ou não pôde ser removida/i);
  expect(client.getQueryState(chave)?.isInvalidated).toBe(true);
  vi.restoreAllMocks();
});
