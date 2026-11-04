// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { VisitaResumo } from "../../application/visitas-gateway";

const api = vi.hoisted(() => ({ rpc: vi.fn(), listarOs: vi.fn(), usuario: "u" }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }), auth: { getUser: async () => ({ data: { user: { id: api.usuario } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-visitas-adapter", () => ({ supabaseVisitasAdapter: { listarOs: api.listarOs } }));
import { IntencaoOsEnviada } from "./IntencaoOsEnviada";
import { TransferirOsEnviada } from "./TransferirOsEnviada";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); vi.unstubAllEnvs(); api.usuario = "u"; });

const c = "00000000-0000-4000-8000-000000000010";
const origem = "00000000-0000-4000-8000-000000000011";
const destino = "00000000-0000-4000-8000-000000000012";
const vinculo = "00000000-0000-4000-8000-000000000013";

it("não repete intenção quando a tentativa salva mudou", async () => {
  const chave = `sso-os-enviada-intencao:${JSON.stringify(["u", c])}`;
  const tentativa = { requestId: "00000000-0000-4000-8000-000000000001", intencaoId: "00000000-0000-4000-8000-000000000002", clienteId: c, origemId: origem, destinoId: destino, vinculoId: vinculo, revisaoOrigem: 1, revisaoDestino: 1, motivo: "Reprogramação" };
  sessionStorage.setItem(chave, JSON.stringify(tentativa));
  api.rpc.mockImplementation((nome: string) => nome.includes("listar_intencoes")
    ? { abortSignal: async () => ({ data: [], error: null }) }
    : Promise.resolve({ data: null, error: new Error("não deve enviar") }));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={cliente}><IntencaoOsEnviada userId="u" clienteId={c} visitas={[]} bloqueado={false} /></QueryClientProvider>);
  sessionStorage.setItem(chave, JSON.stringify({ ...tentativa, motivo: "Outra tentativa" }));
  fireEvent.click(screen.getByRole("button", { name: "Repetir mesmo pedido" }));
  expect(await screen.findByText(/tentativa local alterada/i)).toBeInTheDocument();
  expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_propor_intencao_os_mediada")).toBe(false);
  expect(JSON.parse(sessionStorage.getItem(chave)!)).toMatchObject({ motivo: "Outra tentativa" });
});

it.each([IntencaoOsEnviada, TransferirOsEnviada])("isola tentativa ao trocar usuário sem desmontar a tela", (Componente) => {
  const tentativa = { requestId: "00000000-0000-4000-8000-000000000001", intencaoId: "00000000-0000-4000-8000-000000000002", clienteId: c, origemId: origem, destinoId: destino, vinculoId: vinculo, revisaoOrigem: 1, revisaoDestino: 1, motivo: "Reprogramação" };
  sessionStorage.setItem(`sso-os-enviada-intencao:${JSON.stringify(["u1", c])}`, JSON.stringify(tentativa));
  sessionStorage.setItem(`sso-transferencia-os-enviada:${JSON.stringify(["u1", c])}`, JSON.stringify({ ...tentativa, novoVinculoId: "00000000-0000-4000-8000-000000000003", sequencia: 1, tarefaEsperada: "123" }));
  api.rpc.mockImplementation(() => ({ abortSignal: async () => ({ data: [], error: null }) }));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tela = (userId: string, clienteId = c) => <QueryClientProvider client={cliente}><Componente userId={userId} clienteId={clienteId} visitas={[]} bloqueado={false} /></QueryClientProvider>;
  const { rerender } = render(tela("u1"));
  expect(screen.getByRole("button", { name: /Repetir/ })).toBeInTheDocument();
  rerender(tela("u2"));
  expect(screen.queryByRole("button", { name: /Repetir/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Registrar intenção|Transferir e registrar intenção/ })).toBeDisabled();
  rerender(tela("u1"));
  expect(screen.getByRole("button", { name: /Repetir/ })).toBeInTheDocument();
  rerender(tela("u1", "outro-cliente"));
  expect(screen.queryByRole("button", { name: /Repetir/ })).not.toBeInTheDocument();
  expect(sessionStorage.getItem(`sso-os-enviada-intencao:${JSON.stringify(["u1", c])}`)).not.toBeNull();
});

it("registra e consulta intenção pelas entradas mediadas sem afirmar alteração remota", async () => {
  api.listarOs.mockResolvedValue([{ id: vinculo, osId: "os", numero: "OS-1", titulo: "Teste", sequencia: 1 }]);
  api.rpc.mockImplementation((nome: string, p: Record<string, unknown>) => {
    if (nome.includes("listar_intencoes")) return { abortSignal: async () => ({ data: [], error: null }) };
    return Promise.resolve({ data: { requestId: p.p_request_id, intencaoId: p.p_intencao_id, efeitoRemoto: false }, error: null });
  });
  const visitas = [
    { id: origem, estado: "enviada", revisao: 1, inicioEm: "2026-11-02" },
    { id: destino, estado: "planejada", revisao: 2, inicioEm: "2026-11-09" },
  ] as VisitaResumo[];
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={cliente}><IntencaoOsEnviada userId="u" clienteId={c} visitas={visitas} bloqueado={false} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Origem"), { target: { value: origem } });
  fireEvent.change(screen.getByLabelText("Destino"), { target: { value: destino } });
  await screen.findByRole("option", { name: /OS-1/ });
  fireEvent.change(screen.getByLabelText("OS"), { target: { value: vinculo } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Reprogramação" } });
  fireEvent.click(screen.getByLabelText(/Conferi OS, Visitas/));
  fireEvent.click(screen.getByRole("button", { name: "Registrar intenção" }));
  expect(await screen.findByRole("status")).toHaveTextContent(/não foram reprogramadas/i);
  await waitFor(() => expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_listar_intencoes_os_mediada")).toBe(true));
  expect(api.rpc.mock.calls.some(([nome]) => nome === "sso_propor_intencao_os_mediada")).toBe(true);
});

it("transfere OS enviada com intenção pendente sem afirmar atualização remota", async () => {
  vi.stubEnv("VITE_SSO_TRANSFERENCIA_OS_ENVIADA_ENABLED", "true");
  api.listarOs.mockResolvedValue([{ id: vinculo, osId: "os", numero: "OS-1", titulo: "Teste", sequencia: 1 }]);
  api.rpc.mockImplementation((nome: string, p: Record<string, unknown>) => {
    if (nome.includes("listar_intencoes")) return { abortSignal: async () => ({ data: [], error: null }) };
    if (nome === "sso_consultar_identidade_transferencia") return { abortSignal: async () => ({ data: { clienteId: p.p_cliente_id, origemId: p.p_origem_id, vinculoId: p.p_vinculo_id, osId: "os", tarefaAuvoId: "123965" }, error: null }) };
    return Promise.resolve({ data: { requestId: p.p_request_id, intencaoId: p.p_intencao_id, origemId: p.p_origem_id, destinoId: p.p_destino_id, novoVinculoId: p.p_novo_vinculo_id, tarefaAuvoId: "123965", efeitoRemoto: false, estadoIntencao: "pendente" }, error: null });
  });
  const visitas = [
    { id: origem, estado: "enviada", revisao: 1, inicioEm: "2026-11-02" },
    { id: destino, estado: "planejada", revisao: 2, inicioEm: "2026-11-09" },
  ] as VisitaResumo[];
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={cliente}><IntencaoOsEnviada userId="u" clienteId={c} visitas={visitas} bloqueado={false} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Origem da transferência"), { target: { value: origem } });
  fireEvent.change(screen.getByLabelText("Destino da transferência"), { target: { value: destino } });
  await screen.findByRole("option", { name: /OS-1/ });
  fireEvent.change(screen.getByLabelText("OS para transferir"), { target: { value: vinculo } });
  expect(await screen.findByText(/Tarefa no SSO: 123965/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Motivo da transferência"), { target: { value: "Reprogramação" } });
  fireEvent.click(screen.getByLabelText(/Conferi a mesma OS/));
  fireEvent.click(screen.getByRole("button", { name: "Transferir e registrar intenção" }));
  expect(await screen.findByText(/transferência local registrada/i)).toBeInTheDocument();
  expect(api.rpc.mock.calls.some(([nome, p]) => nome === "sso_transferir_os_enviada_conferida" && p.p_tarefa_esperada === "123965")).toBe(true);
});
