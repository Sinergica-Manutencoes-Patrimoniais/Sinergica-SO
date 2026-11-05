// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  getUser: vi.fn(),
  autorizarAcao: vi.fn(),
  listarPlanos: vi.fn(),
  salvarPlano: vi.fn(),
  retirarRotina: vi.fn(),
}));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser } },
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: api,
}));
vi.mock("../../infrastructure/supabase-plano-manutencao-adapter", () => ({
  supabasePlanoManutencaoAdapter: api,
}));
import { RetiradaRotina } from "./RetiradaRotina";
import { PlanoManutencaoWorkspace } from "./Workspace";
const id = (n: number) => `16500000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const usuario = id(1);
const clienteId = id(2);
const planoId = id(3);
const rotinaId = id(4);
const requestId = id(5);
const auth = () => ({ data: { user: { id: usuario } }, error: null });
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  api.getUser.mockResolvedValue(auth());
  api.autorizarAcao.mockResolvedValue(true);
  api.listarPlanos.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
it.each(["plano", "retirada"] as const)(
  "preserva e repete mesmo pedido de %s diante de recibo divergente",
  async (tipo) => {
    const plano = { requestId, expectedRevision: 0, planoId, clienteId, nome: "Preventivo" };
    const retirada = {
      requestId,
      expectedRevision: 1,
      planoId,
      rotinaId,
      motivo: "Escopo revisto",
    };
    const comando = tipo === "plano" ? plano : retirada;
    const chave =
      tipo === "plano"
        ? `sso-plano-pendente:${usuario}:${clienteId}`
        : `sso-rotina-retirada:${usuario}:${clienteId}:${planoId}`;
    sessionStorage.setItem(chave, JSON.stringify(comando));
    const fn = tipo === "plano" ? api.salvarPlano : api.retirarRotina;
    const recibo = {
      requestId,
      aggregateId: planoId,
      revision: tipo === "plano" ? 1 : 2,
      state: "rascunho",
      created: tipo === "plano",
      linkedIds: { clienteId, ...(tipo === "retirada" ? { rotinaId } : {}) },
      warnings: [],
    };
    fn.mockResolvedValueOnce({ ...recibo, requestId: id(9) }).mockResolvedValueOnce(recibo);
    const atualizar = vi.fn();
    const ui =
      tipo === "plano" ? (
        <PlanoManutencaoWorkspace userId={usuario} clienteId={clienteId} clienteNome="Cliente" />
      ) : (
        <RetiradaRotina
          userId={usuario}
          clienteId={clienteId}
          plano={{ id: planoId, revisao: 1 } as never}
          rotinas={[{ id: rotinaId, nome: "Rotina" } as never]}
          permitirNova
          onAtivo={() => {}}
          onAtualizar={atualizar}
        />
      );
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        {ui}
      </QueryClientProvider>,
    );
    const nome = tipo === "plano" ? "Tentar salvar novamente" : "Tentar retirada novamente";
    const botao = await screen.findByRole("button", { name: nome });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    await screen.findByText(/Não foi possível confirmar/i);
    expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(comando));
    fireEvent.click(screen.getByRole("button", { name: nome }));
    await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
    expect(fn.mock.calls[1]?.[0]).toEqual(fn.mock.calls[0]?.[0]);
  },
);
it.each(["plano", "retirada"] as const)(
  "troca de sessão após escrita preserva pedido de %s",
  async (tipo) => {
    const comando =
      tipo === "plano"
        ? { requestId, expectedRevision: 0, planoId, clienteId, nome: "Preventivo" }
        : { requestId, expectedRevision: 1, planoId, rotinaId, motivo: "Escopo revisto" };
    const chave =
      tipo === "plano"
        ? `sso-plano-pendente:${usuario}:${clienteId}`
        : `sso-rotina-retirada:${usuario}:${clienteId}:${planoId}`;
    sessionStorage.setItem(chave, JSON.stringify(comando));
    const fn = tipo === "plano" ? api.salvarPlano : api.retirarRotina;
    fn.mockImplementationOnce(async () => {
      api.getUser.mockResolvedValue({ data: { user: { id: id(9) } }, error: null });
      return {
        requestId,
        aggregateId: planoId,
        revision: tipo === "plano" ? 1 : 2,
        state: "rascunho",
        created: tipo === "plano",
        linkedIds: { clienteId, ...(tipo === "retirada" ? { rotinaId } : {}) },
        warnings: [],
      };
    });
    const ui =
      tipo === "plano" ? (
        <PlanoManutencaoWorkspace userId={usuario} clienteId={clienteId} clienteNome="Cliente" />
      ) : (
        <RetiradaRotina
          userId={usuario}
          clienteId={clienteId}
          plano={{ id: planoId, revisao: 1 } as never}
          rotinas={[{ id: rotinaId, nome: "Rotina" } as never]}
          permitirNova
          onAtivo={() => {}}
          onAtualizar={() => {}}
        />
      );
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        {ui}
      </QueryClientProvider>,
    );
    const botao = await screen.findByRole("button", {
      name: tipo === "plano" ? "Tentar salvar novamente" : "Tentar retirada novamente",
    });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    await screen.findByText(/Não foi possível confirmar/i);
    expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(comando));
  },
);
