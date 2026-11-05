// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), sessao: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: api.sessao }));
vi.mock("../../infrastructure/supabase-calendario-contratual-adapter", () => ({
  supabaseCalendarioContratualAdapter: { listarRegras: async () => [] },
}));
import { OrigemGeracaoRotina } from "./OrigemGeracaoRotina";
import { ResolverRetiradaImpacto } from "./ResolverRetiradaImpacto";
import { VincularSerieRotina } from "./VincularSerieRotina";
const id = (n: number) => `18100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const comuns = {
  userId: id(1),
  clienteId: id(2),
  planoId: id(3),
  versaoId: id(4),
  rotinaId: id(5),
  revision: 1,
};
const casos = [
  {
    nome: "origem",
    chave: `sso-origem-rotina:${JSON.stringify([id(1), id(2), id(3), id(4), id(5)])}`,
    pedido: {
      requestId: id(7),
      clienteId: id(2),
      planoId: id(3),
      versaoId: id(4),
      rotinaId: id(5),
      revision: 1,
      origem: "plano",
      motivo: "Conferido",
    },
    rpc: "sso_declarar_origem_rotina",
    botao: "Repetir tentativa pendente",
    elemento: <OrigemGeracaoRotina {...comuns} />,
    recibo: {
      requestId: id(7),
      planoId: id(3),
      versaoId: id(4),
      rotinaId: id(5),
      origem: "plano",
      exclusividadePmocComprovada: false,
      ocorrenciaCriada: false,
      osCriada: false,
      tarefaAuvoCriada: false,
    },
  },
  {
    nome: "vínculo",
    chave: `sso-rotina-serie:${JSON.stringify([id(1), id(2), id(3), id(5)])}`,
    pedido: {
      requestId: id(7),
      clienteId: id(2),
      planoId: id(3),
      versaoId: id(4),
      rotinaId: id(5),
      serieId: id(6),
      revision: 1,
      tentativaIncerta: true,
    },
    rpc: "sso_vincular_serie_rotina_mediado",
    botao: "Repetir mesmo pedido",
    elemento: <VincularSerieRotina {...comuns} />,
    recibo: { requestId: id(7), planoId: id(3), serieId: id(6) },
  },
  {
    nome: "retirada",
    chave: `sso-retirada-impacto:${JSON.stringify([id(1), id(2), id(3), id(4), id(5), 1, "calendario"])}`,
    pedido: {
      requestId: id(7),
      clienteId: id(2),
      planoId: id(3),
      rascunhoId: id(4),
      preparadaId: id(5),
      planoRevision: 2,
      decisaoRevision: 1,
      tipo: "calendario",
      motivo: "Conferido",
    },
    rpc: "sso_resolver_impacto_retirada",
    botao: "Repetir tentativa pendente",
    elemento: (
      <ResolverRetiradaImpacto
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        rascunhoId={id(4)}
        preparadaId={id(5)}
        planoRevision={2}
        decisaoRevision={1}
        tipo="calendario"
      />
    ),
    recibo: {
      requestId: id(7),
      preparadaId: id(5),
      revisaoPlano: 2,
      revisaoDecisao: 1,
      decisao: "retirar_geracao",
      resolucaoRegistrada: true,
      ocorrenciaAlterada: false,
      osAlteradas: false,
      aprovacaoAutorizada: false,
    },
  },
] as const;
let autorizada = true;
let enviar: (nome: string, args: Record<string, unknown>) => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  autorizada = true;
  vi.stubEnv("VITE_SSO_ORIGEM_ROTINA_ENABLED", "true");
  vi.stubEnv("VITE_SSO_RESOLUCAO_IMPACTO_ENABLED", "true");
  api.sessao.mockImplementation(async () => {
    if (!autorizada) throw Error("Sessão alterada");
  });
  api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) => {
    if (nome === "sso_consultar_origem_rotina")
      return {
        abortSignal: async () => ({
          data: {
            planoId: id(3),
            versaoId: id(4),
            rotinaId: id(5),
            revisao: 1,
            rotinaLogicaId: id(8),
            alvoTipo: "sistema",
            alvoId: id(9),
            origem: null,
            exclusividadePmocComprovada: false,
          },
          error: null,
        }),
      };
    if (nome === "sso_listar_series_rotina_mediado")
      return { abortSignal: async () => ({ data: [], error: null }) };
    if (nome === "sso_consultar_resolucao_impacto_v2")
      return {
        abortSignal: async () => ({
          data: {
            preparadaId: id(5),
            revisaoDecisao: 1,
            resolvida: false,
            motivo: null,
            resolucaoObsoleta: false,
          },
          error: null,
        }),
      };
    return enviar(nome, args);
  });
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
describe.each(casos)("pedido de $nome", (c) => {
  it("preserva após troca de sessão e repete a mesma chamada", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let concluir!: (x: unknown) => void;
    enviar = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    montar(c.elemento);
    fireEvent.click(screen.getByRole("button", { name: c.botao }));
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    const salvo = sessionStorage.getItem(c.chave);
    const primeira = api.rpc.mock.calls.find(([nome]) => nome === c.rpc);
    if (!primeira) throw Error("Chamada ausente");
    autorizada = false;
    concluir({ data: c.recibo, error: null });
    await screen.findByText(/Resultado não confirmado/);
    expect(sessionStorage.getItem(c.chave)).toBe(salvo);
    autorizada = true;
    enviar = async () => ({ data: c.recibo, error: null });
    const botao = screen.getByRole("button", { name: c.botao });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await waitFor(() => expect(sessionStorage.getItem(c.chave)).toBeNull());
    const chamadas = api.rpc.mock.calls.filter(([nome]) => nome === c.rpc);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toEqual(chamadas[0]);
  });
  it("não envia quando a tentativa muda durante a autenticação", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let liberar!: () => void;
    api.sessao.mockImplementation((_ator: string, signal?: AbortSignal) =>
      signal
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            liberar = resolve;
          }),
    );
    enviar = async () => ({ data: c.recibo, error: null });
    montar(c.elemento);
    fireEvent.click(screen.getByRole("button", { name: c.botao }));
    await waitFor(() => expect(liberar).toBeTypeOf("function"));
    sessionStorage.setItem(c.chave, "alterado");
    liberar();
    await screen.findByText(/Resultado não confirmado/);
    expect(api.rpc.mock.calls.filter(([nome]) => nome === c.rpc)).toHaveLength(0);
    expect(sessionStorage.getItem(c.chave)).toBe("alterado");
  });
  it("preserva tentativa ao desmontar antes da resposta", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let concluir!: (x: unknown) => void;
    enviar = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    const tela = montar(c.elemento);
    fireEvent.click(screen.getByRole("button", { name: c.botao }));
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    const salvo = sessionStorage.getItem(c.chave);
    tela.unmount();
    const antes = api.sessao.mock.calls.length;
    concluir({ data: c.recibo, error: null });
    await waitFor(() => expect(api.sessao.mock.calls.length).toBeGreaterThan(antes));
    expect(sessionStorage.getItem(c.chave)).toBe(salvo);
  });
});
