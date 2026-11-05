// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EstadoGrupo } from "./EstadoGrupo";
import { FotosGrupo } from "./FotosGrupo";
import { RemoverCaracteristicaGrupo } from "./RemoverCaracteristicaGrupo";

const api = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: api.getUser },
    schema: () => ({ rpc: api.rpc }),
    functions: { invoke: api.invoke },
  },
}));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const userId = id(1);
const clienteId = id(2);
const grupoId = id(3);
const requestId = id(4);
const base = { requestId, userId, clienteId, grupoId, revision: 1 };
const grupo = {
  id: grupoId,
  clienteId,
  localId: id(5),
  categoriaId: id(6),
  sistemaId: null,
  nome: "Grupo",
  quantidade: 4,
  caracteristicas: { potencia: "10" },
  revisao: 1,
};
const auth = () => ({ data: { user: { id: userId } }, error: null });
function montar(elemento: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{elemento}</QueryClientProvider>);
}
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  api.getUser.mockResolvedValue(auth());
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it.each(["estado", "característica"] as const)(
  "não envia %s se o pedido muda durante autenticação",
  async (tipo) => {
    const estado = tipo === "estado";
    vi.stubEnv(
      estado ? "VITE_SSO_ESTADO_GRUPO_ENABLED" : "VITE_SSO_REMOVER_CARACTERISTICA_GRUPO_ENABLED",
      "true",
    );
    const chave = `${estado ? "sso-estado-grupo" : "sso-remover-caracteristica"}:${JSON.stringify([userId, clienteId, grupoId])}`;
    const pedido = estado
      ? { ...base, ativo: false, motivo: "Conferido" }
      : { ...base, chave: "potencia", motivo: "Conferido" };
    sessionStorage.setItem(chave, JSON.stringify(pedido));
    api.getUser.mockImplementation(async () => {
      sessionStorage.setItem(chave, "pedido alterado");
      return auth();
    });
    montar(
      estado ? (
        <EstadoGrupo
          userId={userId}
          clienteId={clienteId}
          grupoId={grupoId}
          nome="Grupo"
          revisao={1}
          ativo
          disponivel
        />
      ) : (
        <RemoverCaracteristicaGrupo
          userId={userId}
          clienteId={clienteId}
          grupo={grupo}
          disponivel
        />
      ),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: estado ? "Repetir alteração de estado" : "Repetir remoção",
      }),
    );
    await screen.findByText(/Resultado não confirmado/);
    expect(api.rpc).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(chave)).toBe("pedido alterado");
  },
);

it("não envia foto se a tentativa muda durante o cálculo do arquivo", async () => {
  vi.stubEnv("VITE_SSO_FOTOS_GRUPO_ENABLED", "true");
  const chave = `sso-foto-grupo-v2:${JSON.stringify([userId, clienteId, grupoId])}`;
  const pedido = {
    requestId,
    grupoId,
    clienteId,
    nome: `${clienteId}/${grupoId}/${id(8)}`,
    hash: "00".repeat(32),
    tipo: "image/png",
  };
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  let digests = 0;
  const digest = vi.fn(async () => {
    digests++;
    if (digests === 2) sessionStorage.setItem(chave, "pedido alterado");
    return new Uint8Array(32).buffer;
  });
  vi.stubGlobal("crypto", { subtle: { digest } });
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: [], error: null }) });
  montar(<FotosGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} podeEditar />);
  const arquivo = new File(["imagem"], "foto.png", { type: "image/png" });
  Object.defineProperty(arquivo, "arrayBuffer", {
    value: async () => new Uint8Array([1, 2, 3]).buffer,
  });
  fireEvent.change(screen.getByLabelText(/Imagem JPEG ou PNG/), { target: { files: [arquivo] } });
  fireEvent.click(screen.getByRole("button", { name: "Repetir envio" }));
  await waitFor(() => expect(digest).toHaveBeenCalledTimes(2));
  expect(sessionStorage.getItem(chave)).toBe("pedido alterado");
  expect(api.getUser).toHaveBeenCalled();
  await screen.findByText(/Não foi possível confirmar/);
  expect(api.invoke).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(chave)).toBe("pedido alterado");
});

it.each(["Grupo", "Cliente"] as const)(
  "preserva tentativa quando %s muda durante resposta da foto",
  async (contexto) => {
    vi.stubEnv("VITE_SSO_FOTOS_GRUPO_ENABLED", "true");
    const chave = `sso-foto-grupo-v2:${JSON.stringify([userId, clienteId, grupoId])}`;
    const pedido = {
      requestId,
      grupoId,
      clienteId,
      nome: `${clienteId}/${grupoId}/${id(8)}`,
      hash: "00".repeat(32),
      tipo: "image/png",
    };
    const salvo = JSON.stringify(pedido);
    sessionStorage.setItem(chave, salvo);
    vi.stubGlobal("crypto", { subtle: { digest: vi.fn(async () => new Uint8Array(32).buffer) } });
    api.rpc.mockReturnValue({ abortSignal: async () => ({ data: [], error: null }) });
    let completar: (valor: { data: { fotoId: string; requestId: string }; error: null }) => void =
      () => {
        throw new Error("Envio não iniciado");
      };
    api.invoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          completar = resolve;
        }),
    );
    const tela = montar(
      <FotosGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} podeEditar />,
    );
    const arquivo = new File(["imagem"], "foto.png", { type: "image/png" });
    Object.defineProperty(arquivo, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    fireEvent.change(screen.getByLabelText(/Imagem JPEG ou PNG/), { target: { files: [arquivo] } });
    fireEvent.click(screen.getByRole("button", { name: "Repetir envio" }));
    await waitFor(() => expect(api.invoke).toHaveBeenCalledTimes(1));
    const novoCliente = contexto === "Cliente" ? id(9) : clienteId;
    const novoGrupo = contexto === "Grupo" ? id(10) : grupoId;
    tela.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <FotosGrupo userId={userId} clienteId={novoCliente} grupoId={novoGrupo} podeEditar />
      </QueryClientProvider>,
    );
    await act(async () => {
      completar({ data: { fotoId: id(11), requestId }, error: null });
    });
    expect(sessionStorage.getItem(chave)).toBe(salvo);
    expect(
      sessionStorage.getItem(
        `sso-foto-grupo-v2:${JSON.stringify([userId, novoCliente, novoGrupo])}`,
      ),
    ).toBeNull();
    expect(screen.queryByText("Foto vinculada.")).toBeNull();
  },
);
