// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { schema: api.schema, auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } } }));
vi.mock("./FilaPreventivaPcm", () => ({ FilaPreventivaPcm: ({ preparadaId }: { preparadaId: string }) => <p>Fila calendário: {preparadaId}</p> }));
import { MaterializarCicloCanonico } from "./MaterializarCicloCanonico";
import { MaterializarLoteCalendario } from "./MaterializarLoteCalendario";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const base = { userId: "u", clienteId: "00000000-0000-4000-8000-000000000001", planoId: "00000000-0000-4000-8000-000000000002", versaoId: "00000000-0000-4000-8000-000000000003", rotinaId: "00000000-0000-4000-8000-000000000004", revision: 1 };

it.each(["ciclo", "lote"] as const)("%s não apaga outra tentativa enquanto aguarda resposta", async (tipo) => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  let concluir!: (value: unknown) => void;
  api.rpc.mockImplementation(() => new Promise((resolve) => { concluir = resolve; }));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}>{tipo === "ciclo"
    ? <MaterializarCicloCanonico {...base} ciclo={0} vencimento="2026-10-30" />
    : <MaterializarLoteCalendario {...base} inicio="2026-10-30" fim="2026-10-30" ciclos={[{ciclo:0,vencimento:"2026-10-30"}]} />}</QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: tipo === "ciclo" ? "Preparar ciclo" : "Preparar lote" }));
  await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(1));
  const pedido = api.rpc.mock.calls[0]![1];
  const chave = sessionStorage.key(0)!;
  const substituto = JSON.stringify({ requestId: "outra-tentativa" });
  sessionStorage.setItem(chave, substituto);
  concluir({ data: tipo === "ciclo"
    ? { requestId: pedido.p_request_id, indice: 0, vencimentoOriginal: "2026-10-30", preparadaId: "00000000-0000-4000-8000-000000000011", cicloCanonicoId: "00000000-0000-4000-8000-000000000012", criada: true, osCriada: false, tarefaAuvoCriada: false }
    : { requestId: pedido.p_request_id, inicio: pedido.p_inicio, fim: pedido.p_fim, atomico: true, total: 1, criadas: 1, itens: [{ indice: 0, vencimentoOriginal: "2026-10-30", preparadaId: "00000000-0000-4000-8000-000000000011", cicloCanonicoId: "00000000-0000-4000-8000-000000000012", criada: true }], osCriada: false, tarefaAuvoCriada: false }, error: null });
  await waitFor(() => expect(screen.getByText(/tentativa alterada ou não removida/i)).toBeTruthy());
  expect(sessionStorage.getItem(chave)).toBe(substituto);
});

it.each(["ciclo", "lote"] as const)("%s não sobrescreve tentativa criada por outra instância", async (tipo) => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}>{tipo === "ciclo"
    ? <MaterializarCicloCanonico {...base} ciclo={0} vencimento="2026-10-30" />
    : <MaterializarLoteCalendario {...base} inicio="2026-10-30" fim="2026-10-30" ciclos={[{ ciclo: 0, vencimento: "2026-10-30" }]} />}</QueryClientProvider>);
  const chave = tipo === "ciclo"
    ? `sso-ciclo-canonico:${JSON.stringify([base.userId, base.clienteId, base.planoId, base.versaoId, base.rotinaId, 0, "2026-10-30"])}`
    : `sso-lote-ciclos-calendario:${JSON.stringify([base.userId, base.clienteId, base.planoId, base.versaoId, base.rotinaId])}`;
  sessionStorage.setItem(chave, "outra tentativa");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: tipo === "ciclo" ? "Preparar ciclo" : "Preparar lote" }));
  expect(api.rpc).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(chave)).toBe("outra tentativa");
});

it.each(["ciclo", "lote"] as const)("%s repete exatamente o pedido após falha incerta", async (tipo) => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockResolvedValueOnce({ data: null, error: new Error("rede") });
  api.rpc.mockImplementationOnce((_nome, p) => Promise.resolve({ data: tipo === "ciclo"
    ? { requestId: p.p_request_id, indice: 0, vencimentoOriginal: "2026-10-30", preparadaId: "00000000-0000-4000-8000-000000000011", cicloCanonicoId: "00000000-0000-4000-8000-000000000012", criada: true, osCriada: false, tarefaAuvoCriada: false }
    : { requestId: p.p_request_id, inicio: p.p_inicio, fim: p.p_fim, atomico: true, total: 1, criadas: 1, itens: [{ indice: 0, vencimentoOriginal: "2026-10-30", preparadaId: "00000000-0000-4000-8000-000000000011", cicloCanonicoId: "00000000-0000-4000-8000-000000000012", criada: true }], osCriada: false, tarefaAuvoCriada: false }, error: null }));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}>{tipo === "ciclo"
    ? <MaterializarCicloCanonico {...base} ciclo={0} vencimento="2026-10-30" />
    : <MaterializarLoteCalendario {...base} inicio="2026-10-30" fim="2026-10-30" ciclos={[{ ciclo: 0, vencimento: "2026-10-30" }]} />}</QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: tipo === "ciclo" ? "Preparar ciclo" : "Preparar lote" }));
  const repetir = await screen.findByRole("button", { name: "Repetir tentativa pendente" });
  await waitFor(() => expect((repetir as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(repetir);
  await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(2));
  expect(api.rpc.mock.calls[1]![1]).toEqual(api.rpc.mock.calls[0]![1]);
  await waitFor(() => expect(sessionStorage.length).toBe(0));
});

it.each(["ciclo", "lote"] as const)("%s atualiza o histórico canônico após preparação", async (tipo) => {
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockImplementation((_nome, p) => Promise.resolve({ data: tipo === "ciclo"
    ? { requestId: p.p_request_id, indice: 0, vencimentoOriginal: "2026-10-30", preparadaId: "00000000-0000-4000-8000-000000000011", cicloCanonicoId: "00000000-0000-4000-8000-000000000012", criada: true, osCriada: false, tarefaAuvoCriada: false }
    : { requestId: p.p_request_id, inicio: p.p_inicio, fim: p.p_fim, atomico: true, total: 1, criadas: 1, itens: [{ indice: 0, vencimentoOriginal: "2026-10-30", preparadaId: "00000000-0000-4000-8000-000000000011", cicloCanonicoId: "00000000-0000-4000-8000-000000000012", criada: true }], osCriada: false, tarefaAuvoCriada: false }, error: null }));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidar = vi.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}>{tipo === "ciclo"
    ? <MaterializarCicloCanonico {...base} ciclo={0} vencimento="2026-10-30" />
    : <MaterializarLoteCalendario {...base} inicio="2026-10-30" fim="2026-10-30" ciclos={[{ ciclo: 0, vencimento: "2026-10-30" }]} />}</QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: tipo === "ciclo" ? "Preparar ciclo" : "Preparar lote" }));
  await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: tipo === "ciclo"
    ? ["historico-ciclo-canonico", base.userId, base.clienteId, base.planoId, base.versaoId, base.rotinaId, 0]
    : ["historico-ciclo-canonico", base.userId, base.clienteId, base.planoId, base.versaoId, base.rotinaId] }));
});

it.each(["ciclo", "lote"] as const)("%s não oferece tentativa de usuário anterior", (tipo) => {
  const chave = tipo === "ciclo"
    ? `sso-ciclo-canonico:${JSON.stringify([base.userId, base.clienteId, base.planoId, base.versaoId, base.rotinaId, 0, "2026-10-30"])}`
    : `sso-lote-ciclos-calendario:${JSON.stringify([base.userId, base.clienteId, base.planoId, base.versaoId, base.rotinaId])}`;
  sessionStorage.setItem(chave, JSON.stringify({ requestId: "00000000-0000-4000-8000-000000000005", clienteId: base.clienteId, planoId: base.planoId, versaoId: base.versaoId, rotinaId: base.rotinaId, revision: 1, ...(tipo === "ciclo" ? { ciclo: 0, vencimento: "2026-10-30" } : { inicio: "2026-10-30", fim: "2026-10-30" }) }));
  const client = new QueryClient();
  const componente = (userId: string) => <QueryClientProvider client={client}>{tipo === "ciclo"
    ? <MaterializarCicloCanonico {...base} userId={userId} ciclo={0} vencimento="2026-10-30" />
    : <MaterializarLoteCalendario {...base} userId={userId} inicio="2026-10-30" fim="2026-10-30" ciclos={[{ciclo:0,vencimento:"2026-10-30"}]} />}</QueryClientProvider>;
  const { rerender } = render(componente("u"));
  expect(screen.getByRole("button", { name: "Repetir tentativa pendente" })).toBeTruthy();
  rerender(componente("outro"));
  expect(screen.queryByRole("button", { name: "Repetir tentativa pendente" })).toBeNull();
  expect(sessionStorage.getItem(chave)).not.toBeNull();
});


it("encaminha ciclo e lote à conferência da fila", async () => {
  vi.stubEnv("VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED", "true");
  for (const tipo of ["ciclo", "lote"] as const) {
  vi.stubEnv("VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED", "true");
  api.rpc.mockReset();
  api.schema.mockReturnValue({ rpc: api.rpc });
  const item = { indice: 0, vencimentoOriginal: "2026-10-30", preparadaId: "00000000-0000-4000-8000-000000000011", cicloCanonicoId: "00000000-0000-4000-8000-000000000012", criada: true };
  api.rpc.mockImplementation((_nome, p) => Promise.resolve({ data: tipo === "ciclo" ? { requestId: p.p_request_id, ...item, osCriada: false, tarefaAuvoCriada: false } : { requestId: p.p_request_id, inicio: p.p_inicio, fim: p.p_fim, atomico: true, total: 1, criadas: 1, itens: [item], osCriada: false, tarefaAuvoCriada: false }, error: null }));
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={client}>{tipo === "ciclo" ? <MaterializarCicloCanonico {...base} ciclo={0} vencimento="2026-10-30" /> : <MaterializarLoteCalendario {...base} inicio="2026-10-30" fim="2026-10-30" ciclos={[{ ciclo: 0, vencimento: "2026-10-30" }]} />}</QueryClientProvider>);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: tipo === "ciclo" ? "Preparar ciclo" : "Preparar lote" }));
  fireEvent.click(await screen.findByRole("button", { name: "Conferir inclusão na fila" }));
  expect(screen.getByText(`Fila calendário: ${item.preparadaId}`)).toBeInTheDocument();
  expect(api.rpc).toHaveBeenCalledTimes(1);
  cleanup();
  }
});
