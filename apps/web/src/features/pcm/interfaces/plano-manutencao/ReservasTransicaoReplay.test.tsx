// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), sessao: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: api.sessao }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: async () => true },
}));
import { ReservaCicloFuturo } from "./ReservaCicloFuturo";
import { ReservaCicloLegado } from "./ReservaCicloLegado";
import { TransicaoPlano } from "./TransicaoPlano";
const id = (n: number) => `18130000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const casos = [
  {
    nome: "reserva futura",
    chave: `sso-reserva-futuro:${JSON.stringify([id(1), id(2), id(3), id(4), id(5), id(6)])}`,
    pedido: {
      request: id(8),
      cliente: id(2),
      plano: id(3),
      versao: id(4),
      rotina: id(5),
      legado: id(6),
      modo: "calendario",
      rascunho: false,
      data: "2026-11-06",
      visita: "",
      indiceSso: 1,
      indice: 2,
      revisaoPlano: 1,
      revisaoReserva: 0,
      decisao: "somente_sso",
      motivo: "Conferido",
      foto: {},
    },
    rpc: "sso_decidir_reserva_calendario_futuro",
    botao: "Repetir mesma tentativa",
    elemento: (
      <ReservaCicloFuturo
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        versaoId={id(4)}
        rotinaId={id(5)}
        legadoId={id(6)}
        revision={1}
      />
    ),
    recibo: {
      requestId: id(8),
      revisao: 1,
      decisao: "somente_sso",
      ocorrenciaCriada: false,
      osCriada: false,
      tarefaAuvoCriada: false,
      reservaId: id(9),
      cicloId: id(10),
      replay: false,
    },
  },
  {
    nome: "reserva legada",
    chave: `sso-reserva-ciclo:${JSON.stringify([id(1), id(2), id(3), id(6), "visita"])}`,
    pedido: {
      requestId: id(8),
      cliente: id(2),
      plano: id(3),
      legado: id(6),
      indice: 2,
      modo: "visita",
      preparada: id(7),
      decisao: "somente_sso",
      revisaoPlano: 1,
      revisaoReserva: 0,
      fotoEsperada: {},
      motivo: "Conferido",
    },
    rpc: "sso_decidir_reserva_ciclo_legado",
    botao: "Repetir mesma tentativa",
    elemento: (
      <ReservaCicloLegado
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        legadoId={id(6)}
        revision={1}
        modo="visita"
        consultando={false}
      />
    ),
    recibo: {
      requestId: id(8),
      reservaId: id(9),
      revisao: 1,
      decisao: "somente_sso",
      replay: false,
    },
  },
  {
    nome: "transição",
    chave: `sso-plano-transicao:${JSON.stringify([id(1), id(2), id(3)])}`,
    pedido: {
      requestId: id(8),
      planoId: id(3),
      clienteId: id(2),
      revision: 1,
      acao: "suspender",
      vigencia: "2026-11-06",
      motivo: "Conferido",
      tentativaIncerta: true,
    },
    rpc: "sso_transicao_plano_mediada",
    botao: "Repetir mesmo pedido",
    elemento: (
      <TransicaoPlano
        userId={id(1)}
        clienteId={id(2)}
        plano={{ id: id(3), clienteId: id(2), nome: "Plano", estado: "aprovado", revisao: 1 }}
        bloqueado={false}
      />
    ),
    recibo: { requestId: id(8), aggregateId: id(3), revision: 2, linkedIds: { clienteId: id(2) } },
  },
] as const;
let enviar: () => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.stubEnv("VITE_SSO_TRANSICAO_PLANO_MEDIADA_ENABLED", "true");
  api.sessao.mockResolvedValue(undefined);
  api.getUser.mockResolvedValue({ data: { user: { id: id(1) } }, error: null });
  api.rpc.mockImplementation((nome: string) =>
    casos.some((c) => c.rpc === nome)
      ? enviar()
      : { abortSignal: async () => ({ data: [], error: null }) },
  );
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
});
function montar(elemento: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {elemento}
    </QueryClientProvider>,
  );
}
describe.each(casos)("$nome", (c) => {
  it("mantém pedido ao desmontar com chamada em andamento", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let concluir!: (v: unknown) => void;
    enviar = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    const tela = montar(c.elemento);
    const botao = await screen.findByRole("button", { name: c.botao });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    const salvo = sessionStorage.getItem(c.chave);
    tela.unmount();
    await act(async () => {
      concluir({ data: c.recibo, error: null });
      await Promise.resolve();
    });
    expect(sessionStorage.getItem(c.chave)).toBe(salvo);
  });
  if (c.nome !== "transição")
    it("não envia após desmontar durante autenticação", async () => {
      sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
      let liberar!: () => void;
      api.sessao.mockImplementation((_u: string, signal?: AbortSignal) =>
        signal
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              liberar = resolve;
            }),
      );
      enviar = async () => ({ data: c.recibo, error: null });
      const tela = montar(c.elemento);
      fireEvent.click(await screen.findByRole("button", { name: c.botao }));
      await waitFor(() => expect(liberar).toBeTypeOf("function"));
      tela.unmount();
      await act(async () => {
        liberar();
        await Promise.resolve();
      });
      expect(api.rpc.mock.calls.filter(([nome]) => nome === c.rpc)).toHaveLength(0);
      expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
    });
  it("repete a mesma chamada após falha incerta", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    enviar = async () => ({ data: null, error: { code: "40001" } });
    montar(c.elemento);
    const botao = await screen.findByRole("button", { name: c.botao });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await screen.findByText(/Resultado não confirmado/);
    const salvo = sessionStorage.getItem(c.chave);
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await waitFor(() =>
      expect(api.rpc.mock.calls.filter(([nome]) => nome === c.rpc)).toHaveLength(2),
    );
    const chamadas = api.rpc.mock.calls.filter(([nome]) => nome === c.rpc);
    expect(chamadas[1]).toEqual(chamadas[0]);
    expect(sessionStorage.getItem(c.chave)).toBe(salvo);
  });
});
