// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: mock.getUser }, schema: () => ({ rpc: mock.rpc }) } }));
vi.mock("../interfaces/plano-manutencao/FilaPreventivaPcm", () => ({ FilaPreventivaPcm: ({ tipo, preparadaId }: { tipo: string; preparadaId: string }) => <p>Gestão {tipo}: {preparadaId}</p> }));
import { FilaVisitaWorkspace } from "./FilaVisitaWorkspace";
const id = (n: string) => `16610000-0000-4000-8000-${n.padStart(12, "0")}`;
const item = { ciclo_id: id("1"), preparada_id: id("2"), estado: "aguardando", revisao: 1, vencimento: "2026-11-10", atualizado_em: "2026-11-01T00:00:00Z", rotina_id: id("3"), rotina_nome: "Extintores", alvo_tipo: "sistema", alvo_id: id("4"), versao_origem_id: id("5"), visita_id: id("6"), situacao_atual: "conferida" };
function montar() { const query = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={query}><FilaVisitaWorkspace userId="usuario" clienteId={id("7")} planoId={id("8")} estado="aguardando" inicio="2026-11-01" fim="2026-11-30" /></QueryClientProvider>); }
beforeEach(() => { mock.getUser.mockResolvedValue({ data: { user: { id: "usuario" } }, error: null }); mock.rpc.mockReturnValue({ abortSignal: async () => ({ data: [item], error: null }) }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("consulta somente Visitas do Plano e encaminha a gestão ao modo correto", async () => {
  montar();
  expect(await screen.findByText(/Rotina de referência: Extintores/)).toBeInTheDocument();
  expect(mock.rpc).toHaveBeenCalledWith("sso_listar_fila_visita_cronologica_v2", expect.objectContaining({ p_cliente_id: id("7"), p_plano_id: id("8"), p_estado: "aguardando", p_inicio: "2026-11-01", p_fim: "2026-11-30" }));
  fireEvent.click(screen.getByRole("button", { name: "Gerenciar entrada" }));
  expect(screen.getByText(`Gestão visita: ${id("2")}`)).toBeInTheDocument();
});

it("não consulta dados se a sessão não corresponde ao contexto", async () => {
  mock.getUser.mockResolvedValue({ data: { user: { id: "outro" } }, error: null });
  montar();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conferir");
  expect(mock.rpc).not.toHaveBeenCalled();
});

it("avisa quando a fonte mudou depois da entrada na fila", async () => {
  mock.rpc.mockReturnValue({ abortSignal: async () => ({ data: [{ ...item, situacao_atual: "verificacao" }], error: null }) });
  montar();
  expect(await screen.findByText(/fonte exige nova verificação/i)).toBeInTheDocument();
  expect(screen.getByText(/registro aguardando/i)).toBeInTheDocument();
});
