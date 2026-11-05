// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegraContratualResumo } from "../../application/calendario-contratual-gateway";

const api = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: api.getUser }, schema: () => ({ rpc: api.rpc }) },
}));
import { RegistrarSupressao } from "./RegistrarSupressao";
import { SupressoesFeriado } from "./SupressoesFeriado";

const id = (n: number) => `18090000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const regra: RegraContratualResumo = {
  id: id(5),
  serieId: id(4),
  contratoId: id(6),
  numero: 1,
  ancoraSemana: "2026-11-02",
  diaSemana: 5,
  intervaloSemanas: 1,
  horaInicio: "08:00",
  duracaoMinutos: 60,
  deslocamentoMinutos: 0,
  fuso: "America/Sao_Paulo",
  vigenciaInicio: "2026-01-01",
  vigenciaFim: null,
};
const linha = {
  supressao_id: id(7),
  serie_id: id(4),
  regra_id: id(5),
  semana_origem: "2026-11-02",
  data_contratual: "2026-11-06",
  feriado_ativo: false,
  revogada: false,
  criado_em: "2026-11-01T12:00:00Z",
};
let usuario = id(1);
let resposta: (args: Record<string, unknown>) => Promise<unknown>;
const recibo = (modo: string, args: Record<string, unknown>) => ({
  data:
    modo === "registro"
      ? {
          requestId: args.p_request_id,
          serieId: id(4),
          semanaOrigem: "2026-11-02",
          dataContratual: "2026-11-06",
          supressaoId: id(7),
          visitaCriada: false,
          ocorrenciaCriada: false,
          osCriada: false,
          tarefaAuvoCriada: false,
        }
      : {
          requestId: args.p_request_id,
          supressaoId: id(7),
          revogada: true,
          visitaCriada: false,
          ocorrenciaCriada: false,
          osCriada: false,
          tarefaAuvoCriada: false,
        },
  error: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  usuario = id(1);
  vi.stubEnv("VITE_SSO_SUPRESSOES_FERIADO_ENABLED", "true");
  api.getUser.mockImplementation(async () => ({ data: { user: { id: usuario } }, error: null }));
  api.rpc.mockImplementation((nome: string, args: Record<string, unknown>) =>
    nome.startsWith("sso_listar_supressoes_feriado")
      ? { abortSignal: async () => ({ data: [linha], error: null }) }
      : resposta(args),
  );
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
});
function montar(modo: string) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {modo === "registro" ? (
        <RegistrarSupressao
          userId={id(1)}
          clienteId={id(2)}
          feriadoId={id(3)}
          feriadoRevision={1}
          data="2026-11-06"
          contratoId={id(6)}
          ativo
          regras={[regra]}
        />
      ) : (
        <SupressoesFeriado userId={id(1)} clienteId={id(2)} feriadoId={id(3)} />
      )}
    </QueryClientProvider>,
  );
}
async function iniciar(modo: string) {
  if (modo === "registro") {
    fireEvent.change(screen.getByLabelText("Regra contratual"), { target: { value: id(5) } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Registrar supressão" }));
  } else {
    fireEvent.click(screen.getByRole("button", { name: "Consultar semanas suprimidas" }));
    fireEvent.change(await screen.findByLabelText("Motivo da revogação"), {
      target: { value: "Conferido" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revogar supressão" }));
  }
}

describe.each(["registro", "revogação"])("%s de supressão", (modo) => {
  const chave =
    modo === "registro"
      ? `sso-registrar-supressao:${JSON.stringify([id(1), id(2), id(3)])}`
      : `sso-revogacao-supressao:${JSON.stringify([id(1), id(2), id(7)])}`;
  const rpc =
    modo === "registro" ? "sso_registrar_supressao_semana" : "sso_revogar_supressao_semana";
  const repetir = modo === "registro" ? "Repetir registro" : "Repetir revogação";
  it("preserva pedido após troca de sessão e repete o mesmo payload", async () => {
    let concluir!: (valor: unknown) => void;
    resposta = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    montar(modo);
    await iniciar(modo);
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    const salvo = sessionStorage.getItem(chave);
    expect(salvo).toBeTruthy();
    const primeira = api.rpc.mock.calls.find(([nome]) => nome === rpc);
    if (!primeira) throw new Error("Chamada ausente");
    usuario = id(8);
    concluir(recibo(modo, primeira[1]));
    await screen.findByText(/Resultado não confirmado/);
    expect(sessionStorage.getItem(chave)).toBe(salvo);
    usuario = id(1);
    resposta = async (args) => recibo(modo, args);
    const botao = screen.getByRole("button", { name: repetir });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
    const chamadas = api.rpc.mock.calls.filter(([nome]) => nome === rpc);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toEqual(chamadas[0]);
  });
  it("não envia pedido alterado enquanto autentica", async () => {
    resposta = async (args) => recibo(modo, args);
    montar(modo);
    if (modo === "revogação") {
      fireEvent.click(screen.getByRole("button", { name: "Consultar semanas suprimidas" }));
      await screen.findByLabelText("Motivo da revogação");
    }
    let liberar!: (valor: unknown) => void;
    api.getUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          liberar = resolve;
        }),
    );
    if (modo === "registro") {
      fireEvent.change(screen.getByLabelText("Regra contratual"), { target: { value: id(5) } });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Registrar supressão" }));
    } else {
      fireEvent.change(screen.getByLabelText("Motivo da revogação"), {
        target: { value: "Conferido" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Revogar supressão" }));
    }
    await waitFor(() => expect(liberar).toBeTypeOf("function"));
    sessionStorage.setItem(chave, "alterado");
    liberar({ data: { user: { id: id(1) } }, error: null });
    await screen.findByText(/Resultado não confirmado/);
    expect(api.rpc.mock.calls.filter(([nome]) => nome === rpc)).toHaveLength(0);
    expect(sessionStorage.getItem(chave)).toBe("alterado");
  });
  it("preserva pedido se desmontar antes da resposta", async () => {
    let concluir!: (valor: unknown) => void;
    resposta = () =>
      new Promise((resolve) => {
        concluir = resolve;
      });
    const tela = montar(modo);
    await iniciar(modo);
    await waitFor(() => expect(concluir).toBeTypeOf("function"));
    const salvo = sessionStorage.getItem(chave);
    expect(salvo).toBeTruthy();
    const chamada = api.rpc.mock.calls.find(([nome]) => nome === rpc);
    if (!chamada) throw new Error("Chamada ausente");
    tela.unmount();
    const antes = api.getUser.mock.calls.length;
    concluir(recibo(modo, chamada[1]));
    await waitFor(() => expect(api.getUser.mock.calls.length).toBeGreaterThan(antes));
    expect(sessionStorage.getItem(chave)).toBe(salvo);
  });
});
