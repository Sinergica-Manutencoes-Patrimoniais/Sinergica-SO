// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: id(1) } }, error: null }) },
    schema: () => ({ rpc: api.rpc }),
  },
}));
import { AlterarDiaComVisitasV2 } from "./AlterarDiaComVisitasV2";
import { AlterarDiaComVisitas } from "./AlterarDiaComVisitas";
const id = (n: number) => `17600000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const props = { userId: id(1), clienteId: id(2), serieId: id(3), revisao: 1, dia: 2, vigencia: "2026-12-07", bloqueado: false, operacionalHabilitado: true };

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

it("oculta fotografia da revisão anterior e exige encerramento separado ao mudar parâmetros", async () => {
  vi.stubEnv("VITE_SSO_MUDANCA_DIA_V2_ENABLED", "true");
  api.rpc.mockImplementation((nome: string) => {
    if (nome === "sso_iniciar_mudanca_dia_v2") return Promise.resolve({ data: {
      mudancaId: id(40), requestId: id(41), estado: "montando", expiraEm: "2026-12-01T00:00:00Z",
      paginaSeguinte: 0, paginaFinal: false, totalItens: 501,
    }, error: null });
    if (nome === "sso_pagina_mudanca_dia_v2") return Promise.resolve({ data: {
      mudancaId: id(40), numero: 0, itens: [{ visitaId: id(50), revisao: 1, semanaOrigem: "2026-12-07",
        inicioOriginal: "2026-12-08T12:00:00Z", dataProposta: "2026-12-09", inicioProposto: "2026-12-09T12:00:00Z",
        feriadoId: null, feriadoRevision: null, ocorrenciaEsperada: false }], temMais: true, proximoNumero: 1, totalItens: 501,
    }, error: null });
    if (nome === "sso_invalidar_mudanca_dia_v2") return Promise.resolve({ data: { mudancaId: id(40), estado: "invalidada" }, error: null });
    throw new Error(`RPC inesperada: ${nome}`);
  });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><AlterarDiaComVisitasV2 {...props} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: /Preparar fotografia/ }));
  await screen.findByText(/Em andamento: fotografia iniciada/);
  fireEvent.click(screen.getByRole("button", { name: /Retomar fotografia/ }));
  await screen.findByText(new RegExp(id(50)));
  view.rerender(<QueryClientProvider client={client}><AlterarDiaComVisitasV2 {...props} revisao={2} /></QueryClientProvider>);
  expect(await screen.findByRole("alert")).toHaveTextContent(/parâmetros da alteração mudaram/i);
  expect(screen.queryByText(new RegExp(id(50)))).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Encerrar fotografia anterior/ }));
  await screen.findByText(/fotografia anterior encerrada/i);
  expect(api.rpc.mock.calls.filter(([nome]) => nome === "sso_invalidar_mudanca_dia_v2")).toHaveLength(1);
});

it("persiste requestId antes do RPC para repetir o mesmo início após falha de rede", async () => {
  vi.stubEnv("VITE_SSO_MUDANCA_DIA_V2_ENABLED", "true");
  const requestIds: string[] = [];
  api.rpc.mockImplementation((nome: string, p: Record<string, unknown>) => {
    if (nome === "sso_iniciar_mudanca_dia_v2") {
      requestIds.push(String(p.p_request_id));
      return Promise.resolve({ data: null, error: { code: "XX000", message: "falha simulada" } });
    }
    throw new Error(`RPC inesperada: ${nome}`);
  });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AlterarDiaComVisitasV2 {...props} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: /Preparar fotografia/ }));
  await screen.findByText(/falha simulada/);
  fireEvent.click(screen.getByRole("button", { name: /Preparar fotografia/ }));
  await screen.findAllByText(/falha simulada/);
  expect(requestIds).toHaveLength(2);
  expect(requestIds[0]).toBe(requestIds[1]);
});

it("apresenta Em andamento ao retomar fotografia persistida com mais de 500 Visitas", () => {
  const identityKey = `sso-mudanca-dia-v2:${JSON.stringify([props.userId, props.clienteId, props.serieId])}`;
  const assinatura = JSON.stringify([props.userId, props.clienteId, props.serieId, props.revisao, props.dia, props.vigencia]);
  const storageKey = `${identityKey}:${assinatura}`;
  sessionStorage.setItem(`${identityKey}:ativa`, storageKey);
  sessionStorage.setItem(storageKey, JSON.stringify({
    ator: props.userId,
    cliente: props.clienteId,
    serie: props.serieId,
    assinatura,
    mudancaId: id(40),
    requestId: id(41),
    estado: "montando",
    paginaAtual: 5,
    paginaFinal: false,
    totalItens: 501,
    digest: null,
    paginasRevistas: [0, 1, 2, 3, 4],
    revisaoConfirmada: false,
  }));
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><AlterarDiaComVisitasV2 {...props} /></QueryClientProvider>);
  expect(screen.getByRole("status")).toHaveTextContent(/Em andamento.*fotografia salva.*página 6/i);
  expect(screen.getByRole("button", { name: /Retomar fotografia.*página 6/i })).toBeEnabled();
});

it("mostra o fluxo na jornada com a operação desabilitada até o gate/ensaio", () => {
  vi.stubEnv("VITE_SSO_MUDANCA_DIA_V2_UI_ENABLED", "true");
  vi.stubEnv("VITE_SSO_MUDANCA_DIA_V2_ENABLED", "false");
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><AlterarDiaComVisitas {...props} /></QueryClientProvider>);
  expect(screen.getByRole("status")).toHaveTextContent(/aguarda ensaio de volume/i);
  expect(screen.getByRole("button", { name: /Preparar fotografia/ })).toBeDisabled();
  expect(api.rpc).not.toHaveBeenCalled();
});
