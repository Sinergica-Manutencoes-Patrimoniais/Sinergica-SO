// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: async () => true },
}));
import { AprovarFinalizarAtomico } from "./AprovarFinalizarAtomico";
import { AprovarRetornoPcm } from "./AprovarRetornoPcm";
import { ConferenciaCobertura } from "./ConferenciaCobertura";
import { DecisoesRetorno } from "./DecisoesRetorno";
import { ReatestarCobertura } from "./ReatestarCobertura";
import { ValidacaoResposta } from "./ValidacaoResposta";
const id = (n: number) => `18140000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const b = { requestId: id(8), clienteId: id(2), retornoId: id(3) };
const conf = { ...b, conferenciaId: id(4), evidencias: 1, decisao: 0, justificativa: "Conferido" };
const casos = [
  {
    nome: "decisão",
    chave: `sso-retorno-decisao:${JSON.stringify([id(1), id(2), id(3)])}`,
    pedido: { ...b, revision: 0, decisao: "devolver", motivo: "Conferido" },
    rpc: "sso_decidir_retorno_mediado",
    botao: "Repetir tentativa pendente",
    elemento: <DecisoesRetorno userId={id(1)} clienteId={id(2)} retornoId={id(3)} />,
    recibo: { requestId: id(8), retornoId: id(3), decisaoId: id(9), revision: 1 },
  },
  {
    nome: "validação",
    chave: `sso-validacao-resposta:${JSON.stringify([id(1), id(2), id(3), id(5), id(6)])}`,
    pedido: {
      ...b,
      respostaId: id(5),
      evidenciaId: id(6),
      decisaoRevision: 0,
      uploadsRevision: 1,
      decisao: "aceita_pcm",
      justificativa: "Conferido",
    },
    rpc: "sso_validar_resposta_evidencia_mediada",
    botao: "Repetir tentativa pendente",
    elemento: (
      <ValidacaoResposta
        userId={id(1)}
        clienteId={id(2)}
        retornoId={id(3)}
        respostaId={id(5)}
        evidenciaId={id(6)}
        uploadsRevision={1}
      />
    ),
    recibo: { requestId: id(8), validacaoId: id(9), revision: 1, conteudoAutenticado: false },
  },
  {
    nome: "conferência",
    chave: `sso-cobertura-retorno:${JSON.stringify([id(1), id(2), id(3)])}`,
    pedido: { ...b, evidenciaId: null, revision: 0, justificativa: "Conferido" },
    rpc: "sso_conferir_cobertura_mediada",
    botao: "Repetir tentativa pendente",
    elemento: (
      <ConferenciaCobertura
        userId={id(1)}
        clienteId={id(2)}
        retornoId={id(3)}
        revision={0}
        evidencias={[]}
      />
    ),
    recibo: {
      requestId: id(8),
      retornoId: id(3),
      conferenciaId: id(9),
      coberturaEstrutural: true,
      evidenciaExternaComprovada: false,
    },
  },
  {
    nome: "reatestação",
    chave: `sso-reatestacao:${JSON.stringify([id(1), id(2), id(3), id(4)])}`,
    pedido: conf,
    rpc: "sso_reatestar_cobertura_mediada",
    botao: "Repetir tentativa pendente",
    elemento: (
      <ReatestarCobertura
        userId={id(1)}
        clienteId={id(2)}
        retornoId={id(3)}
        conferenciaId={id(4)}
      />
    ),
    recibo: {
      requestId: id(8),
      reatestacaoId: id(9),
      conferenciaId: id(10),
      evidenciaExternaComprovada: false,
    },
  },
  {
    nome: "aprovação",
    chave: `sso-atestacao-pcm:${JSON.stringify([id(1), id(2), id(3), id(4)])}`,
    pedido: conf,
    rpc: "sso_atestar_aprovar_retorno_mediado",
    botao: "Repetir tentativa pendente",
    elemento: (
      <AprovarRetornoPcm
        userId={id(1)}
        clienteId={id(2)}
        retornoId={id(3)}
        conferenciaId={id(4)}
        evidencias={1}
        decisao={0}
        historicoCompleto
      />
    ),
    recibo: {
      requestId: id(8),
      retornoId: id(3),
      condicaoEvidenciaId: id(9),
      decisaoId: id(10),
      revision: 1,
      pendenciasProcessadas: 0,
      osEncerrada: false,
      conteudoAutenticado: false,
    },
  },
  {
    nome: "aprovação atômica",
    chave: `sso-aprovacao-finalizacao:${JSON.stringify([id(1), id(2), id(3), id(4)])}`,
    pedido: { ...conf, osId: id(7), status: "aberta", updatedAt: "2026-11-01T12:00:00Z" },
    rpc: "sso_aprovar_finalizar_os_atomico",
    botao: "Repetir mesma tentativa",
    elemento: (
      <AprovarFinalizarAtomico
        userId={id(1)}
        clienteId={id(2)}
        retornoId={id(3)}
        conferenciaId={id(4)}
        evidencias={1}
        decisao={0}
        historicoCompleto
      />
    ),
    recibo: {
      requestId: id(8),
      retornoId: id(3),
      osId: id(7),
      revision: 1,
      pendenciasProcessadas: 0,
      osEncerrada: true,
      chamadoAlterado: false,
      conteudoAutenticado: false,
    },
  },
] as const;
let enviar: () => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
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
  it("preserva pedido após desmontagem com resposta pendente", async () => {
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
    expect(api.rpc.mock.calls.filter(([nome]) => nome === c.rpc)).toHaveLength(1);
    const salvo = sessionStorage.getItem(c.chave);
    tela.unmount();
    await act(async () => {
      concluir({ data: c.recibo, error: null });
      await Promise.resolve();
    });
    expect(sessionStorage.getItem(c.chave)).toBe(salvo);
  });
  it("preserva e repete payload após resultado incerto", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    enviar = async () => ({ data: null, error: { code: "40001" } });
    montar(c.elemento);
    const botao = await screen.findByRole("button", { name: c.botao });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await screen.findByText(/Resultado não confirmado/i);
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
