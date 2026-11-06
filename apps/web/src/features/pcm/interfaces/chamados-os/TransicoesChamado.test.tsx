// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(async () => ({ data: { user: { id: "u" } }, error: null })) }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) } }));
import { EncerrarChamadoConferido } from "./EncerrarChamadoConferido";
import { CancelarChamadoConservador } from "./CancelarChamadoConservador";
import { ReabrirChamado } from "./ReabrirChamado";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });
const casos = [
  { prefixo: "sso-encerrar-chamado", rpc: "sso_encerrar_chamado_conferido", Componente: EncerrarChamadoConferido },
  { prefixo: "sso-cancelar-chamado", rpc: "sso_cancelar_chamado_conservador", Componente: CancelarChamadoConservador },
  { prefixo: "sso-reabrir-chamado", rpc: "sso_reabrir_chamado", Componente: ReabrirChamado },
] as const;

it.each(casos.slice(0, 2))("$prefixo exige nova confirmação após mudança de revisão ou motivo", ({ Componente }) => {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tela = (revision: number) => <QueryClientProvider client={cliente}><Componente usuario="u" cliente="c" chamado="h" revision={revision} incompleto={false} /></QueryClientProvider>;
  const { rerender } = render(tela(1));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "motivo" } });
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("checkbox")).toBeChecked();
  rerender(tela(2));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "outro motivo" } });
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});

it.each(casos.slice(0, 2))("$prefixo preserva tentativa quando sessão muda antes do envio", async ({ prefixo, rpc, Componente }) => {
  const chave = `${prefixo}:["u","c","h"]`;
  const pedido = { requestId: "r", clienteId: "c", chamadoId: "h", revision: 1, motivo: "motivo" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.getUser.mockResolvedValueOnce({ data: { user: { id: "outro" } }, error: null });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><Componente usuario="u" cliente="c" chamado="h" revision={1} incompleto={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(screen.getByText(/resultado não confirmado/i)).toBeInTheDocument());
  expect(api.rpc.mock.calls.some(([nome]) => nome === rpc)).toBe(false);
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toEqual(pedido);
});

it.each(casos)("$prefixo isola tentativa ao trocar usuário", ({ prefixo, Componente }) => {
  const chave = `${prefixo}:["u","c","h"]`;
  sessionStorage.setItem(chave, JSON.stringify({ requestId: "r", clienteId: "c", chamadoId: "h", revision: 1, motivo: "motivo" }));
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_reabertura_chamado"
    ? { abortSignal: async () => ({ data: { chamadoId: "h", revision: 1, reabrivel: true, status: "encerrado", encerradoEm: null }, error: null }) }
    : { abortSignal: async () => ({ data: [], error: null }) });
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tela = (usuario: string) => <QueryClientProvider client={cliente}><Componente usuario={usuario} cliente="c" chamado="h" revision={1} incompleto={false} /></QueryClientProvider>;
  const { rerender } = render(tela("u"));
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeInTheDocument();
  rerender(tela("outro"));
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).not.toBeInTheDocument();
  expect(sessionStorage.getItem(chave)).not.toBeNull();
});

it.each(casos)("$prefixo não substitui tentativa alterada ao repetir", async ({ prefixo, rpc, Componente }) => {
  const chave = `${prefixo}:["u","c","h"]`;
  const pedido = { requestId: "r", clienteId: "c", chamadoId: "h", revision: 1, motivo: "motivo" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_reabertura_chamado"
    ? { abortSignal: async () => ({ data: { chamadoId: "h", revision: 1, reabrivel: true, status: "encerrado", encerradoEm: null }, error: null }) }
    : nome === "sso_listar_reaberturas_chamado" ? { abortSignal: async () => ({ data: [], error: null }) } : Promise.resolve({ data: null, error: new Error("não deve enviar") }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><Componente usuario="u" cliente="c" chamado="h" revision={1} incompleto={false} /></QueryClientProvider>);
  sessionStorage.setItem(chave, JSON.stringify({ ...pedido, motivo: "outra tentativa" }));
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(screen.getByText(/tentativa local alterada/i)).toBeInTheDocument());
  expect(api.rpc.mock.calls.some(([nome]) => nome === rpc)).toBe(false);
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toMatchObject({ motivo: "outra tentativa" });
});

it.each(casos)("$prefixo preserva outra tentativa após resposta atrasada", async ({ prefixo, Componente }) => {
  const chave = `${prefixo}:["u","c","h"]`;
  const pedido = { requestId: "r", clienteId: "c", chamadoId: "h", revision: 1, motivo: "motivo" };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  let concluir!: (valor: unknown) => void;
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_reabertura_chamado"
    ? { abortSignal: async () => ({ data: { chamadoId: "h", revision: 1, reabrivel: true, status: "encerrado", encerradoEm: null }, error: null }) }
    : nome === "sso_listar_reaberturas_chamado" ? { abortSignal: async () => ({ data: [], error: null }) } : new Promise((resolve) => { concluir = resolve; }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><Componente usuario="u" cliente="c" chamado="h" revision={1} incompleto={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(concluir).toBeDefined());
  sessionStorage.setItem(chave, JSON.stringify({ ...pedido, motivo: "outra tentativa" }));
  concluir({ data: { requestId: "r", osAlteradas: false, state: "cancelado" }, error: null });
  await waitFor(() => expect(screen.getByText(/tentativa local alterada/i)).toBeInTheDocument());
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toMatchObject({ motivo: "outra tentativa" });
});

it.each(casos)("$prefixo conclui repetição idêntica e remove apenas seu pedido", async ({ prefixo, Componente }) => {
  const chave = `${prefixo}:["u","c","h"]`;
  sessionStorage.setItem(chave, JSON.stringify({ requestId: "r", clienteId: "c", chamadoId: "h", revision: 1, motivo: "motivo" }));
  api.rpc.mockImplementation((nome: string) => nome === "sso_consultar_reabertura_chamado"
    ? { abortSignal: async () => ({ data: { chamadoId: "h", revision: 1, reabrivel: true, status: "encerrado", encerradoEm: null }, error: null }) }
    : nome === "sso_listar_reaberturas_chamado" ? { abortSignal: async () => ({ data: [], error: null }) }
    : Promise.resolve({ data: { requestId: "r", osAlteradas: false, state: "cancelado" }, error: null }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><Componente usuario="u" cliente="c" chamado="h" revision={1} incompleto={false} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).not.toBeInTheDocument();
});
