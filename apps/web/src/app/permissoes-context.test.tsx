// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PermissoesProvider, usePermissoes } from "./permissoes-context";

const mocks = vi.hoisted(() => ({
  sessao: { user: { id: "A", papel: "colaborador" }, status: "autenticado" },
  resolver: vi.fn(),
}));
vi.mock("./auth-context", () => ({ useAuth: () => mocks.sessao }));
vi.mock("../features/config/application/resolver-minhas-permissoes", () => ({
  resolverMinhasPermissoes: mocks.resolver,
}));
vi.mock("../features/config/infrastructure/supabase-config-adapter", () => ({
  supabaseConfigAdapter: {},
}));

// E00-S29 — o PermissoesProvider passou a resolver permissão pelo TanStack Query, então precisa
// de um QueryClient. Um por caso de teste, sem retry e sem cache entre casos: o que está sendo
// provado aqui é isolamento de identidade, não comportamento de rede.
function clienteDeTeste() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function Tela() {
  const acesso = usePermissoes();
  return <span>{acesso.podeAcessar("pcm", "escrita") ? "permitido" : "negado"}</span>;
}

describe("isolamento de permissões na interface", () => {
  it("não usa permissões da identidade anterior enquanto consulta a nova", async () => {
    const cliente = clienteDeTeste();
    mocks.sessao = { user: { id: "A", papel: "colaborador" }, status: "autenticado" };
    mocks.resolver
      .mockReset()
      .mockResolvedValueOnce([{ modulo: "pcm", nivel: "escrita" }])
      .mockReturnValueOnce(new Promise(() => {}));
    const tela = render(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("permitido");
    mocks.sessao = { user: { id: "B", papel: "colaborador" }, status: "autenticado" };
    tela.rerender(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("negado")).toBeTruthy());
  });

  it("revalida permissões quando o papel da mesma pessoa muda", async () => {
    const cliente = clienteDeTeste();
    mocks.sessao = { user: { id: "A", papel: "supervisor" }, status: "autenticado" };
    mocks.resolver
      .mockReset()
      .mockResolvedValueOnce([{ modulo: "pcm", nivel: "escrita" }])
      .mockReturnValueOnce(new Promise(() => {}));
    const tela = render(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("permitido");
    mocks.sessao = { user: { id: "A", papel: "colaborador" }, status: "autenticado" };
    tela.rerender(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("negado")).toBeTruthy());
    expect(mocks.resolver).toHaveBeenCalledTimes(2);
  });

  it("descarta resposta antiga depois da troca e mantém recusa em falha", async () => {
    const cliente = clienteDeTeste();
    let terminar!: (valor: { modulo: string; nivel: string }[]) => void;
    mocks.sessao = { user: { id: "A", papel: "colaborador" }, status: "autenticado" };
    mocks.resolver
      .mockReset()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          terminar = resolve;
        }),
      )
      .mockRejectedValueOnce(new Error("negado"));
    const tela = render(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    mocks.sessao = { user: { id: "B", papel: "colaborador" }, status: "autenticado" };
    tela.rerender(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(mocks.resolver).toHaveBeenCalledTimes(2));
    await act(async () => terminar([{ modulo: "pcm", nivel: "escrita" }]));
    expect(screen.getByText("negado")).toBeTruthy();
  });

  it("não recupera permissões antigas ao voltar para identidade anterior", async () => {
    const cliente = clienteDeTeste();
    mocks.sessao = { user: { id: "A", papel: "colaborador" }, status: "autenticado" };
    mocks.resolver
      .mockReset()
      .mockResolvedValueOnce([{ modulo: "pcm", nivel: "escrita" }])
      .mockReturnValue(new Promise(() => {}));
    const tela = render(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("permitido");
    mocks.sessao = { user: { id: "B", papel: "colaborador" }, status: "autenticado" };
    tela.rerender(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("negado")).toBeTruthy();
    mocks.sessao = { user: { id: "A", papel: "colaborador" }, status: "autenticado" };
    tela.rerender(
      <QueryClientProvider client={cliente}>
        <PermissoesProvider>
          <Tela />
        </PermissoesProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("negado")).toBeTruthy();
  });
});
