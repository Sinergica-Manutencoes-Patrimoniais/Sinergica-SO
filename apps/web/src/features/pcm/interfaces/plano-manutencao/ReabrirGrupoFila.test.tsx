// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: vi.fn().mockResolvedValue(undefined) }));
import { ReabrirGrupoFila } from "./ReabrirGrupoFila";
const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); });
it.each(["calendario", "visita"] as const)("reabre %s apenas após confirmação, sem alterar OS", async (tipo) => {
  api.rpc.mockImplementation(async (_nome, p) => ({ error: null, data: { requestId: p.p_request, clienteId: p.p_cliente, planoId: p.p_plano, preparadaId: p.p_preparada, tipo: p.p_tipo, cicloId: id(6), estado: "verificacao", revision: 3, ocorrenciaCriada: false, osAlteradas: false, tarefaAuvoCriada: false } }));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ReabrirGrupoFila userId="usuario" clienteId={id(1)} planoId={id(2)} preparadaId={id(3)} tipo={tipo} revisao={2} /></QueryClientProvider>);
  expect(screen.getByRole("button", { name: "Reabrir conferência" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motivo da reabertura"), { target: { value: "Fonte mudou" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmo devolver/i }));
  fireEvent.click(screen.getByRole("button", { name: "Reabrir conferência" }));
  await waitFor(() => expect(screen.getByText(/Fila voltou para verificação/)).toBeInTheDocument());
  expect(api.rpc).toHaveBeenCalledWith("sso_reabrir_fila_grupo", expect.objectContaining({ p_tipo: tipo, p_fila_revisao: 2, p_motivo: "Fonte mudou" }));
});

it.each([{ code: "P0012", message: "fila_ou_revisao_indisponivel" }])("permite reconferir quando primeira tentativa recebe conflito definitivo $code", async (erro) => {
  api.rpc.mockResolvedValue({ error: erro, data: null });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ReabrirGrupoFila userId="usuario" clienteId={id(1)} planoId={id(2)} preparadaId={id(3)} tipo="calendario" revisao={2} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Motivo da reabertura"), { target: { value: "Fonte mudou" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmo devolver/i }));
  fireEvent.click(screen.getByRole("button", { name: "Reabrir conferência" }));
  await waitFor(() => expect(screen.getByText(/A fila mudou antes/)).toBeInTheDocument());
  expect(sessionStorage.length).toBe(0);
  expect(screen.getByRole("button", { name: "Reabrir conferência" })).toBeDisabled();
});
it.each([{ code: "40001" }, { code: "P0012", message: "fila_ou_revisao_indisponivel" }])("preserva pedido incerto mesmo se repetição recebe conflito $code", async (erro) => {
  api.rpc.mockResolvedValueOnce({ error: { code: "NETWORK" }, data: null }).mockResolvedValueOnce({ error: erro, data: null });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><ReabrirGrupoFila userId="usuario" clienteId={id(1)} planoId={id(2)} preparadaId={id(3)} tipo="visita" revisao={2} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Motivo da reabertura"), { target: { value: "Fonte mudou" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmo devolver/i }));
  fireEvent.click(screen.getByRole("button", { name: "Reabrir conferência" }));
  await waitFor(() => expect(screen.getByText(/Resultado não confirmado/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesma reabertura" }));
  await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(2));
  expect(sessionStorage.length).toBe(1);
  expect(screen.getByRole("button", { name: "Repetir mesma reabertura" })).toBeInTheDocument();
});

it("preserva pedido no primeiro 40001 genérico", async () => {
  api.rpc.mockResolvedValue({ error: { code: "40001" }, data: null });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><ReabrirGrupoFila userId="usuario" clienteId={id(1)} planoId={id(2)} preparadaId={id(3)} tipo="visita" revisao={2} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Motivo da reabertura"), { target: { value: "Fonte mudou" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /confirmo devolver/i }));
  fireEvent.click(screen.getByRole("button", { name: "Reabrir conferência" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.length).toBe(1);
  expect(screen.getByRole("button", { name: "Repetir mesma reabertura" })).toBeInTheDocument();
});
