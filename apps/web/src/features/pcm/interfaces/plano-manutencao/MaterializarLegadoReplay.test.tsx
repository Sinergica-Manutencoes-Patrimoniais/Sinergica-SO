// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), sessao: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) },
}));
vi.mock("./diagnostico-revisao-sessao", () => ({ conferirSessaoDiagnostico: api.sessao }));
vi.mock("./FilaAposPreparacao", () => ({ FilaAposPreparacao: () => null }));
import { MaterializarCicloLegado } from "./MaterializarCicloLegado";
import { MaterializarVisitaLegado } from "./MaterializarVisitaLegado";
const props = {
  userId: "usuario",
  clienteId: "cliente",
  planoId: "plano",
  legadoId: "legado",
  relacaoId: "relacao",
  revision: 1,
};
const base = {
  requestId: "pedido",
  clienteId: "cliente",
  planoId: "plano",
  legadoId: "legado",
  relacaoId: "relacao",
  preparadaId: "preparada",
  motivo: "Conferido",
};
const casos = [
  {
    nome: "ciclo",
    chave: `sso-materializar-ciclo-legado:${JSON.stringify(["usuario", "cliente", "plano", "legado"])}`,
    pedido: { ...base, cicloId: "ciclo" },
    rpc: "sso_materializar_legado_mediado",
    elemento: <MaterializarCicloLegado {...props} />,
    recibo: {
      requestId: "pedido",
      preparadaId: "preparada",
      cicloId: "ciclo",
      ocorrenciaLegadaCriada: true,
      osCriada: false,
      tarefaAuvoCriada: false,
      equivalenciaGeralComprovada: false,
    },
  },
  {
    nome: "visita",
    chave: `sso-materializar-visita-legado:${JSON.stringify(["usuario", "cliente", "plano", "legado"])}`,
    pedido: base,
    rpc: "sso_materializar_visita_legada_mediada",
    elemento: <MaterializarVisitaLegado {...props} />,
    recibo: {
      requestId: "pedido",
      preparadaId: "preparada",
      ocorrenciaLegadaCriada: true,
      planoLegadoCriado: false,
      osCriada: false,
      tarefaAuvoCriada: false,
      filaOficialIntegrada: false,
      fonteFeriadosCompleta: false,
    },
  },
] as const;
let usuario = "usuario";
let resposta: () => Promise<unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  usuario = "usuario";
  api.getUser.mockImplementation(async () => ({ data: { user: { id: usuario } }, error: null }));
  api.sessao.mockImplementation(async () => {
    if (usuario !== "usuario") throw Error("Sessão alterada");
  });
  api.rpc.mockImplementation((nome: string) =>
    nome === "sso_ciclos_legados_mediados" || nome === "sso_visitas_legadas_mediadas"
      ? { abortSignal: async () => ({ data: [], error: null }) }
      : resposta(),
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
describe.each(casos)("materialização $nome", (c) => {
  it("preserva tentativa ao desmontar durante autenticação, sem enviar", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let liberar!: () => void;
    if (c.nome === "visita")
      api.getUser.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            liberar = () => resolve({ data: { user: { id: "usuario" } }, error: null });
          }),
      );
    else
      api.sessao.mockImplementation((_ator: string, signal?: AbortSignal) =>
        signal
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              liberar = resolve;
            }),
      );
    resposta = async () => ({ data: c.recibo, error: null });
    const tela = montar(c.elemento);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
    await waitFor(() => expect(liberar).toBeTypeOf("function"));
    tela.unmount();
    await act(async () => {
      liberar();
      await Promise.resolve();
    });
    expect(api.rpc.mock.calls.filter(([nome]) => nome === c.rpc)).toHaveLength(0);
    expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
  });
  it("preserva tentativa ao desmontar com chamada em andamento", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let concluir!: (v: unknown) => void;
    resposta = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    const tela = montar(c.elemento);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    tela.unmount();
    await act(async () => {
      concluir({ data: c.recibo, error: null });
      await Promise.resolve();
    });
    expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
  });
  it("preserva pedido em troca de sessão e repete o mesmo payload", async () => {
    sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
    let concluir!: (v: unknown) => void;
    resposta = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    montar(c.elemento);
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    usuario = "outro";
    concluir({ data: c.recibo, error: null });
    await screen.findByText(/Resultado não confirmado/);
    expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
    usuario = "usuario";
    resposta = async () => ({ data: c.recibo, error: null });
    const botao = screen.getByRole("button", { name: "Repetir tentativa pendente" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await waitFor(() => expect(sessionStorage.getItem(c.chave)).toBeNull());
    const chamadas = api.rpc.mock.calls.filter(([nome]) => nome === c.rpc);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toEqual(chamadas[0]);
  });
});
it.each([
  { cicloId: "outro", ocorrenciaLegadaCriada: true },
  { cicloId: "ciclo", ocorrenciaLegadaCriada: "sim" },
])("preserva ciclo com recibo divergente %o", async (divergente) => {
  const c = casos[0];
  sessionStorage.setItem(c.chave, JSON.stringify(c.pedido));
  resposta = async () => ({ data: { ...c.recibo, ...divergente }, error: null });
  montar(c.elemento);
  fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa pendente" }));
  await screen.findByText(/Resultado não confirmado/);
  expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
});
