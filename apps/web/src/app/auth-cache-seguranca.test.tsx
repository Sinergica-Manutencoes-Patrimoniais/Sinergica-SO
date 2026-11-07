// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoBasica } from "../features/auth/application/auth-gateway";
import type { PropostaGateway } from "../features/comercial/application/proposta-gateway";
import { usePropostaVersoes } from "../features/comercial/application/proposta-queries";
import { AuthProvider, useAuth } from "./auth-context";

const mocks = vi.hoisted(() => ({
  obter: vi.fn(),
  sair: vi.fn(),
  registrar: vi.fn(),
  entrar: vi.fn(),
  sairAdapter: vi.fn(),
}));
vi.mock("../features/auth/application/get-session", () => ({ getSession: mocks.obter }));
vi.mock("../features/auth/application/sign-in", () => ({ signIn: mocks.entrar }));
vi.mock("../features/auth/application/sign-out", () => ({ signOut: mocks.sair }));
vi.mock("../features/auth/infrastructure/supabase-auth-adapter", () => ({
  supabaseAuthAdapter: { onAuthStateChange: mocks.registrar, signOut: mocks.sairAdapter },
}));

const a = { id: "A", email: "a@teste", nome: "A", papel: "superadmin" as const };
const b = { id: "B", email: "b@teste", nome: "B", papel: "colaborador" as const };
let aoMudar: (s: SessaoBasica | null) => void;

let entrada: Promise<void>;
function Tela() {
  const { user, logout, login, erroSessao } = useAuth();
  const gateway = {
    listarVersoes: async () =>
      user?.id === "A"
        ? [
            {
              id: "v1",
              propostaId: "p1",
              versao: 1,
              payload: { custo: "SEGREDO" },
              criadoEm: "2026-10-27",
              criadoPor: null,
            },
          ]
        : [],
  } as unknown as PropostaGateway;
  const consulta = usePropostaVersoes(gateway, user ? "p1" : null);
  return (
    <>
      <span data-testid="user">{user?.id ?? "nenhum"}</span>
      <span data-testid="erro">{erroSessao}</span>
      <span data-testid="dados">{JSON.stringify(consulta.data ?? null)}</span>
      <button type="button" onClick={logout}>
        Sair
      </button>
      <button
        type="button"
        onClick={() => {
          entrada = login("a@teste", "senha");
        }}
      >
        Entrar
      </button>
    </>
  );
}

describe("cache e transições de sessão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.registrar.mockImplementation((callback) => {
      aoMudar = callback;
      return () => {};
    });
    mocks.obter.mockResolvedValue({ status: "autenticado", usuario: a });
    mocks.sair.mockResolvedValue(undefined);
  });
  function iniciar() {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Tela />
        </AuthProvider>
      </QueryClientProvider>,
    );
    return client;
  }
  it("ao trocar A por B, não reutiliza versões privadas da sessão A", async () => {
    iniciar();
    await screen.findByText(/SEGREDO/);
    mocks.obter.mockResolvedValue({ status: "autenticado", usuario: b });
    act(() => aoMudar({ userId: "B", email: b.email }));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("B"));
    expect(screen.getByTestId("dados").textContent).not.toContain("SEGREDO");
  });
  it("ao sair, remove snapshot privado do cache", async () => {
    const client = iniciar();
    await screen.findByText(/SEGREDO/);
    act(() => screen.getByRole("button", { name: "Sair" }).click());
    expect(client.getQueryData(["comercial", "propostas", "p1", "versoes"])).toBeUndefined();
  });
  it("não restaura usuário quando resolução antiga termina após saída", async () => {
    iniciar();
    await screen.findByText(/SEGREDO/);
    let terminar!: (valor: { status: "autenticado"; usuario: typeof b }) => void;
    mocks.obter.mockReturnValue(
      new Promise((resolve) => {
        terminar = resolve;
      }),
    );
    act(() => aoMudar({ userId: "B", email: b.email }));
    act(() => aoMudar(null));
    await act(async () => terminar({ status: "autenticado", usuario: b }));
    expect(screen.getByTestId("user").textContent).toBe("nenhum");
    expect(screen.getByTestId("dados").textContent).not.toContain("SEGREDO");
  });
  it("não repõe cache quando consulta antiga termina após saída", async () => {
    const client = iniciar();
    await screen.findByText(/SEGREDO/);
    let terminar!: (valor: string) => void;
    const pendente = client
      .fetchQuery({
        queryKey: ["privado-em-voo"],
        queryFn: () =>
          new Promise<string>((resolve) => {
            terminar = resolve;
          }),
      })
      .catch(() => undefined);
    act(() => screen.getByRole("button", { name: "Sair" }).click());
    terminar("SEGREDO");
    await pendente;
    expect(client.getQueryData(["privado-em-voo"])).toBeUndefined();
  });
  it("remove dados anteriores quando sessão inicial não existe", async () => {
    mocks.obter.mockResolvedValue({ status: "sem-sessao" });
    const client = new QueryClient();
    client.setQueryData(["privado"], "SEGREDO");
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Tela />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(client.getQueryData(["privado"])).toBeUndefined());
  });
  it("aguarda resolução do evento de entrada antes de concluir login", async () => {
    mocks.obter.mockResolvedValueOnce({ status: "sem-sessao" });
    iniciar();
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(1));
    let resolverPerfil!: (valor: { status: "autenticado"; usuario: typeof a }) => void;
    mocks.obter.mockReturnValue(
      new Promise((resolve) => {
        resolverPerfil = resolve;
      }),
    );
    mocks.entrar.mockImplementation(async () => {
      aoMudar({ userId: "A", email: a.email });
      return a;
    });
    let concluido = false;
    act(() => screen.getByRole("button", { name: "Entrar" }).click());
    entrada.then(() => {
      concluido = true;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(concluido).toBe(false);
    await act(async () => {
      resolverPerfil({ status: "autenticado", usuario: a });
      await entrada;
    });
    expect(screen.getByTestId("user").textContent).toBe("A");
  });
  it("ignora perfil antigo que termina após perfil de outra sessão", async () => {
    iniciar();
    await screen.findByText(/SEGREDO/);
    let antigo!: (valor: { status: "autenticado"; usuario: typeof a }) => void;
    mocks.obter.mockReturnValueOnce(
      new Promise((resolve) => {
        antigo = resolve;
      }),
    );
    act(() => aoMudar({ userId: "A", email: a.email }));
    mocks.obter.mockResolvedValueOnce({ status: "autenticado", usuario: b });
    act(() => aoMudar({ userId: "B", email: b.email }));
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("B"));
    await act(async () => antigo({ status: "autenticado", usuario: a }));
    expect(screen.getByTestId("user").textContent).toBe("B");
    expect(screen.getByTestId("dados").textContent).not.toContain("SEGREDO");
  });
  it("encerra espera do login ao sair mesmo quando perfil anterior nunca retorna", async () => {
    mocks.obter.mockResolvedValueOnce({ status: "sem-sessao" });
    iniciar();
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(1));
    mocks.obter.mockReturnValue(new Promise(() => {}));
    mocks.entrar.mockImplementation(async () => {
      aoMudar({ userId: "A", email: a.email });
      return a;
    });
    act(() => screen.getByRole("button", { name: "Entrar" }).click());
    let concluido = false;
    entrada.then(() => {
      concluido = true;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(concluido).toBe(false);
    act(() => screen.getByRole("button", { name: "Sair" }).click());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(concluido).toBe(true);
    expect(screen.getByTestId("user").textContent).toBe("nenhum");
  });
  it("encerra espera do login anterior ao receber outra identidade", async () => {
    mocks.obter.mockResolvedValueOnce({ status: "sem-sessao" });
    iniciar();
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(1));
    mocks.obter.mockReturnValue(new Promise(() => {}));
    mocks.entrar.mockImplementation(async () => {
      aoMudar({ userId: "A", email: a.email });
      return a;
    });
    act(() => screen.getByRole("button", { name: "Entrar" }).click());
    let concluido = false;
    entrada.then(() => {
      concluido = true;
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => aoMudar({ userId: "B", email: b.email }));
    await waitFor(() => expect(concluido).toBe(true));
    expect(screen.getByTestId("user").textContent).toBe("nenhum");
  });
  it("preserva erro recebido pelo login", async () => {
    mocks.obter.mockResolvedValueOnce({ status: "sem-sessao" });
    mocks.entrar.mockRejectedValue(new Error("Credenciais inválidas"));
    iniciar();
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(1));
    act(() => screen.getByRole("button", { name: "Entrar" }).click());
    await expect(entrada).rejects.toThrow("Credenciais inválidas");
  });
  it("mantém a interface bloqueada quando o evento falha ao validar perfil durante login", async () => {
    mocks.obter.mockResolvedValueOnce({ status: "sem-sessao" });
    iniciar();
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(1));
    let recusar!: (erro: Error) => void;
    mocks.obter.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        recusar = reject;
      }),
    );
    mocks.entrar.mockImplementationOnce(async () => {
      aoMudar({ userId: "A", email: a.email });
      return a;
    });
    act(() => screen.getByRole("button", { name: "Entrar" }).click());
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("user").textContent).toBe("nenhum");
    await act(async () => {
      recusar(new Error("falha na consulta"));
      await entrada;
    });
    expect(screen.getByTestId("user").textContent).toBe("nenhum");
    expect(screen.getByTestId("erro").textContent).toMatch(/não foi possível restaurar/i);
    expect(screen.getByTestId("dados").textContent).not.toContain("SEGREDO");
  });
  it("só libera a interface após evento validar perfil se a consulta do login falhar", async () => {
    mocks.obter.mockResolvedValueOnce({ status: "sem-sessao" });
    iniciar();
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(1));
    let validar!: (resultado: { status: "autenticado"; usuario: typeof a }) => void;
    mocks.obter.mockReturnValueOnce(
      new Promise((resolve) => {
        validar = resolve;
      }),
    );
    mocks.entrar.mockImplementationOnce(async () => {
      aoMudar({ userId: "A", email: a.email });
      throw new Error("falha na consulta");
    });
    act(() => screen.getByRole("button", { name: "Entrar" }).click());
    await expect(entrada).rejects.toThrow("falha na consulta");
    expect(screen.getByTestId("user").textContent).toBe("nenhum");
    await act(async () => validar({ status: "autenticado", usuario: a }));
    expect(screen.getByTestId("user").textContent).toBe("A");
  });
  it("informa falha de saída sem restaurar dados privados", async () => {
    mocks.sair.mockRejectedValue(new Error("offline"));
    iniciar();
    await screen.findByText(/SEGREDO/);
    act(() => screen.getByRole("button", { name: "Sair" }).click());
    await waitFor(() =>
      expect(screen.getByTestId("erro").textContent).toMatch(/não foi possível encerrar/i),
    );
    expect(screen.getByTestId("user").textContent).toBe("nenhum");
    expect(screen.getByTestId("dados").textContent).not.toContain("SEGREDO");
  });
  it("informa perfil ausente quando signOut emite evento de sessão encerrada", async () => {
    mocks.obter.mockResolvedValueOnce({ status: "sem-perfil", userId: "A" });
    mocks.sairAdapter.mockImplementation(async () => {
      aoMudar(null);
    });
    iniciar();
    await waitFor(() => expect(screen.getByTestId("erro").textContent).toMatch(/sem perfil/i));
    expect(mocks.sairAdapter).toHaveBeenCalledWith("A");
    expect(screen.getByTestId("user").textContent).toBe("nenhum");
  });
  it("não restaura A quando evento de troca informa B mas leitura atrasada retorna A", async () => {
    iniciar();
    await screen.findByText(/SEGREDO/);
    mocks.obter.mockResolvedValueOnce({ status: "autenticado", usuario: a });
    act(() => aoMudar({ userId: "B", email: b.email }));
    await waitFor(() => expect(mocks.obter).toHaveBeenCalledTimes(2));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("user").textContent).not.toBe("A");
    expect(screen.getByTestId("dados").textContent).not.toContain("SEGREDO");
  });
});
