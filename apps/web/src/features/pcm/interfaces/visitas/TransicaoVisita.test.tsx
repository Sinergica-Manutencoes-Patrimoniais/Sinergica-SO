// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { VisitaDetalhe } from "../../application/visitas-gateway";

const chamadas = vi.hoisted(() => ({ transicao: vi.fn(), snapshot: vi.fn(), usuario: "u" }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: chamadas.usuario } }, error: null }) }, schema: (schema: string) => ({ rpc: (nome: string, pedido: unknown) =>
    schema === "config" ? { abortSignal: () => Promise.resolve({ data: true, error: null }) } : nome === "sso_snapshot_capacidade_autorizado" ? { abortSignal: () => chamadas.snapshot(pedido) } : chamadas.transicao(nome, pedido) }) },
}));
import { TransicaoVisita } from "./TransicaoVisita";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); vi.unstubAllEnvs(); chamadas.usuario = "u"; });

it("preserva tentativa se a sessão muda durante a atualização das consultas", async () => {
  let concluirInvalidacao!: () => void;
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const aguardando = new Promise<void>((resolve) => { concluirInvalidacao = resolve; });
  vi.spyOn(cliente, "invalidateQueries").mockReturnValue(aguardando);
  chamadas.transicao.mockImplementation(async (_nome, p) => ({ data: { requestId: p.p_request_id, aggregateId: "v1", revision: 4 }, error: null }));
  const visita = { id: "v1", revisao: 3, fuso: "America/Sao_Paulo" } as VisitaDetalhe;
  render(<QueryClientProvider client={cliente}><TransicaoVisita userId="u" clienteId="c" visita={visita} bloqueado={false} /></QueryClientProvider>);
  await screen.findByRole("button", { name: "Confirmar transição local" });
  fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "cancelar" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Motivo de teste" } });
  const botao = screen.getByRole("button", { name: "Confirmar transição local" });
  await waitFor(() => expect(botao).toBeEnabled());
  fireEvent.click(botao);
  await waitFor(() => expect(cliente.invalidateQueries).toHaveBeenCalled());
  const chave = `sso-visita-transicao:${JSON.stringify(["u", "c", "v1"])}`;
  const tentativa = sessionStorage.getItem(chave);
  expect(tentativa).not.toBeNull();
  chamadas.usuario = "outro";
  await act(async () => concluirInvalidacao());
  expect(await screen.findByRole("status")).toHaveTextContent(/sessão mudou/i);
  expect(sessionStorage.getItem(chave)).toBe(tentativa);
});

it("preserva tentativa diferente criada durante confirmação da Visita", async () => {
  let resolver!: (valor: unknown) => void;
  chamadas.transicao.mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const visita = { id: "v1", revisao: 3, fuso: "America/Sao_Paulo" } as VisitaDetalhe;
  render(<QueryClientProvider client={cliente}><TransicaoVisita userId="u" clienteId="c" visita={visita} bloqueado={false} /></QueryClientProvider>);
  await screen.findByRole("button", { name: "Confirmar transição local" });
  fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "cancelar" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Motivo de teste" } });
  const botao = screen.getByRole("button", { name: "Confirmar transição local" });
  await waitFor(() => expect(botao).toBeEnabled());
  fireEvent.click(botao);
  await waitFor(() => expect(chamadas.transicao).toHaveBeenCalledTimes(1));
  expect(chamadas.transicao.mock.calls[0]![0]).toBe("sso_transicionar_visita_mediada");
  const argumentos = chamadas.transicao.mock.calls[0]![1];
  const chave = `sso-visita-transicao:${JSON.stringify(["u", "c", "v1"])}`;
  const outra = JSON.stringify({ requestId: "outro", visitaId: "v1", clienteId: "c", revision: 4, acao: "cancelar", inicio: null, fim: null, motivo: "Outra tentativa" });
  sessionStorage.setItem(chave, outra);
  await act(async () => resolver({ data: { requestId: argumentos.p_request_id, aggregateId: "v1", revision: 4 }, error: null }));
  expect(sessionStorage.getItem(chave)).toBe(outra);
  expect(await screen.findByRole("status")).toHaveTextContent(/outra tentativa/i);
});

it("não repete tentativa que foi substituída na sessão", async () => {
  const chave = `sso-visita-transicao:${JSON.stringify(["u", "c", "v1"])}`;
  const pedido = { requestId: "primeiro", visitaId: "v1", clienteId: "c", revision: 3, acao: "cancelar", inicio: null, fim: null, motivo: "teste" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { id: "v1", revisao: 3, fuso: "America/Sao_Paulo" } as VisitaDetalhe;
  render(<QueryClientProvider client={cliente}><TransicaoVisita userId="u" clienteId="c" visita={visita} bloqueado={false} /></QueryClientProvider>);
  const repetir = await screen.findByRole("button", { name: "Repetir mesmo pedido" });
  await waitFor(() => expect(repetir).toBeEnabled());
  sessionStorage.setItem(chave, JSON.stringify({ ...pedido, requestId: "outro" }));
  fireEvent.click(repetir);
  expect(chamadas.transicao).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(/alterada/i);
});

it("compara contexto parcial das semanas na reprogramação sem apresentar saldo operacional", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_ENABLED", "true");
  vi.stubEnv("VITE_SSO_COMPARACAO_CAPACIDADE_VISITA_ENABLED", "true");
  chamadas.snapshot.mockImplementation(async (p: { p_cliente_id: string; p_semana_inicio: string }) => ({
    data: { clienteId: p.p_cliente_id, semanaInicio: p.p_semana_inicio, completude: "desconhecida", limiteFontesAtingido: false, limiteOcorrenciasAtingido: false, fontesVisita: [], ocorrenciasSemOs: [] }, error: null,
  }));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { id: "v1", revisao: 3, fuso: "America/Sao_Paulo", inicioEm: "2027-01-04T01:00:00Z" } as VisitaDetalhe;
  render(<QueryClientProvider client={cliente}><TransicaoVisita userId="u" clienteId="c" visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText("Início"), { target: { value: "2027-01-06T12:00" } });
  expect(await screen.findByText(/Origem.*2026-12-28/)).toBeInTheDocument();
  expect(await screen.findByText(/Destino.*2027-01-04/)).toBeInTheDocument();
  expect((await screen.findAllByText(/não representa demanda completa nem saldo/i))).toHaveLength(2);
  expect(chamadas.transicao).not.toHaveBeenCalled();
});

it("não duplica consulta para remanejamento na mesma semana", async () => {
  vi.stubEnv("VITE_SSO_SNAPSHOT_CAPACIDADE_ENABLED", "true");
  vi.stubEnv("VITE_SSO_COMPARACAO_CAPACIDADE_VISITA_ENABLED", "true");
  chamadas.snapshot.mockImplementation(async (p: { p_cliente_id: string; p_semana_inicio: string }) => ({
    data: { clienteId: p.p_cliente_id, semanaInicio: p.p_semana_inicio, completude: "desconhecida", limiteFontesAtingido: false, limiteOcorrenciasAtingido: false, fontesVisita: [], ocorrenciasSemOs: [] }, error: null,
  }));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const visita = { id: "v1", revisao: 3, fuso: "America/Sao_Paulo", inicioEm: "2027-01-04T15:00:00Z" } as VisitaDetalhe;
  render(<QueryClientProvider client={cliente}><TransicaoVisita userId="u" clienteId="c" visita={visita} bloqueado={false} /></QueryClientProvider>);
  fireEvent.change(await screen.findByLabelText("Início"), { target: { value: "2027-01-06T12:00" } });
  expect(await screen.findByText(/Destino na mesma semana/)).toBeInTheDocument();
  await screen.findByText(/não representa demanda completa nem saldo/i);
  expect(chamadas.snapshot).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "cancelar" } });
  expect(screen.queryByLabelText("Contexto parcial das semanas")).not.toBeInTheDocument();
});
