// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) },
}));
import { ConferenciaRotinaCopiada } from "./ConferenciaRotinaCopiada";
import { ContratoEvidencia } from "./ContratoEvidencia";
import { ContratoPerguntas } from "./ContratoPerguntas";
import { NaturezaAlvoRotina } from "./NaturezaAlvoRotina";
const id = (n: number) => `18120000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const props = {
  userId: id(1),
  clienteId: id(2),
  planoId: id(3),
  versaoId: id(4),
  rotinaId: id(5),
  revision: 1,
};
const comum = {
  requestId: id(8),
  clienteId: id(2),
  planoId: id(3),
  versaoId: id(4),
  rotinaId: id(5),
  revision: 1,
  perguntaId: "pergunta",
};
const casos = [
  {
    nome: "pergunta",
    chave: `sso-contrato-pergunta:${JSON.stringify([id(1), id(2), id(3), id(4), id(5)])}`,
    pedido: { ...comum, obrigatoria: true, justificativa: "Conferido" },
    rpc: "sso_configurar_pergunta_mediada",
    botao: "Repetir tentativa pendente",
    elemento: <ContratoPerguntas {...props} />,
    recibo: { requestId: id(8), revision: 2, contratoId: id(9) },
  },
  {
    nome: "evidência",
    chave: `sso-contrato-evidencia:${JSON.stringify([id(1), id(2), id(3), id(4), id(5)])}`,
    pedido: { ...comum, exigida: true, justificativa: "Conferido" },
    rpc: "sso_configurar_evidencia_mediada",
    botao: "Repetir tentativa pendente",
    elemento: <ContratoEvidencia {...props} />,
    recibo: { requestId: id(8), revision: 2, contratoId: id(9) },
  },
  {
    nome: "natureza",
    chave: `sso-natureza-alvo:${JSON.stringify([id(1), id(2), id(3), id(5)])}`,
    pedido: {
      requestId: id(8),
      ator: id(1),
      cliente: id(2),
      plano: id(3),
      rotina: id(5),
      alvo: id(6),
      versao: id(4),
      revisao: 1,
      natureza: "equipamento",
    },
    rpc: "sso_declarar_natureza_alvo_rotina",
    botao: "Repetir mesma tentativa",
    elemento: <NaturezaAlvoRotina {...props} alvoId={id(6)} revisao={1} onAtualizar={() => {}} />,
    recibo: {
      requestId: id(8),
      planoId: id(3),
      rotinaId: id(5),
      versaoId: id(4),
      alvoId: id(6),
      natureza: "equipamento",
      revision: 2,
    },
  },
  {
    nome: "conferência de cópia",
    chave: `sso-conferencia-rotina-copiada:${id(1)}:${id(2)}:${id(3)}:${id(4)}:${id(5)}`,
    pedido: {
      requestId: id(8),
      atorId: id(1),
      clienteId: id(2),
      planoId: id(3),
      versaoId: id(4),
      rotinaId: id(5),
      planoRevision: 1,
      conteudoSha256: "a".repeat(64),
      justificativa: "Conferido",
    },
    rpc: "sso_conferir_rotina_copiada",
    botao: "Repetir mesmo pedido",
    elemento: (
      <ConferenciaRotinaCopiada
        userId={id(1)}
        clienteId={id(2)}
        planoId={id(3)}
        versaoId={id(4)}
        rotinaId={id(5)}
        revisao={1}
      />
    ),
    recibo: {
      requestId: id(8),
      clienteId: id(2),
      planoId: id(3),
      versaoId: id(4),
      rotinaId: id(5),
      planoRevision: 1,
      conteudoSha256: "a".repeat(64),
      declaracaoRegistrada: true,
      aprovacaoRealizada: false,
    },
  },
] as const;
let enviar: () => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.stubEnv("VITE_SSO_CONTRATO_PERGUNTA_MEDIADO_ENABLED", "true");
  vi.stubEnv("VITE_SSO_NATUREZA_ALVO_ROTINA_ENABLED", "true");
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
  it("preserva pedido após desmontar durante a resposta", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let concluir!: (v: unknown) => void;
    enviar = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    const tela = montar(c.elemento);
    fireEvent.click(await screen.findByRole("button", { name: c.botao }));
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
  it("preserva armazenamento alterado e repete o pedido após erro de rede", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let concluir!: (v: unknown) => void;
    enviar = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    montar(c.elemento);
    fireEvent.click(await screen.findByRole("button", { name: c.botao }));
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    expect(api.rpc.mock.calls.filter(([nome]) => nome === c.rpc)).toHaveLength(1);
    const salvo = sessionStorage.getItem(c.chave);
    sessionStorage.setItem(c.chave, "outro pedido");
    await act(async () => {
      concluir({ data: c.recibo, error: null });
    });
    expect(sessionStorage.getItem(c.chave)).toBe("outro pedido");
    if (salvo === null) throw new Error("Pedido ausente");
    sessionStorage.setItem(c.chave, salvo);
    enviar = async () => ({ data: null, error: { code: "40001" } });
    const botao = screen.getByRole("button", { name: c.botao });
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
