// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AtribuirCodigoGrupo } from "./AtribuirCodigoGrupo";

const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: api.getUser },
    schema: () => ({ rpc: api.rpc }),
  },
}));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const userId = id(1);
const clienteId = id(2);
const grupoId = id(3);
const requestId = id(4);
const pedido = { requestId, clienteId, grupoId, codigo: "ABC" };
const chave = `sso-atribuir-codigo-grupo:${JSON.stringify([userId, clienteId, grupoId])}`;
const auth = { data: { user: { id: userId } }, error: null };
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.stubEnv("VITE_SSO_ATRIBUIR_CODIGO_GRUPO_ENABLED", "true");
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  api.getUser.mockResolvedValue(auth);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  sessionStorage.clear();
});

it.each(["autenticação", "resposta"] as const)(
  "preserva pedido ao trocar Grupo durante %s",
  async (fase) => {
    let liberar: (valor: unknown) => void = () => {
      throw new Error("Operação não iniciada");
    };
    if (fase === "autenticação")
      api.getUser.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            liberar = resolve;
          }),
      );
    else
      api.rpc.mockImplementation(
        () =>
          new Promise((resolve) => {
            liberar = resolve;
          }),
      );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <AtribuirCodigoGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Repetir tentativa de ABC" }));
    if (fase === "resposta") await waitFor(() => expect(api.rpc).toHaveBeenCalledTimes(1));
    else await waitFor(() => expect(api.getUser).toHaveBeenCalledTimes(1));
    view.rerender(
      <QueryClientProvider client={client}>
        <AtribuirCodigoGrupo userId={userId} clienteId={clienteId} grupoId={id(5)} />
      </QueryClientProvider>,
    );
    await act(async () => {
      liberar(
        fase === "autenticação" ? auth : { data: { ...pedido, codigoId: id(6) }, error: null },
      );
    });
    expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
    if (fase === "autenticação") expect(api.rpc).not.toHaveBeenCalled();
    expect(screen.queryByText("Código inicial atribuído.")).toBeNull();
  },
);
