// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type {
  CriacaoOsChamadoGateway,
  CriarOsChamado as Pedido,
} from "../../application/chamados-os-comando";
import { CriarOsChamado } from "./CriarOsChamado";
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));

const pedido: Pedido = {
  requestId: "16794000-0000-4000-8000-000000000001",
  osId: "16794000-0000-4000-8000-000000000002",
  clienteId: "16794000-0000-4000-8000-000000000003",
  chamadoId: "16794000-0000-4000-8000-000000000004",
  expectedRevision: 1,
  titulo: "OS de teste",
  descricao: null,
  categoria: "corretiva",
};
const chave = `sso-criar-os:usuario:${pedido.clienteId}:${pedido.chamadoId}`;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllEnvs();
});

function montar(gateway: CriacaoOsChamadoGateway) {
  vi.stubEnv("VITE_SSO_RECONCILIAR_REQUEST_OS_ENABLED", "true");
  sessionStorage.setItem(chave, JSON.stringify(pedido));
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = vi.spyOn(cliente, "invalidateQueries");
  render(
    <QueryClientProvider client={cliente}>
      <CriarOsChamado
        habilitado="true"
        usuario="usuario"
        cliente={pedido.clienteId}
        chamado={pedido.chamadoId}
        chamadoEsperado={pedido.chamadoId}
        gateway={gateway}
      />
    </QueryClientProvider>,
  );
  return invalidar;
}

it("reconcilia tentativa exata e atualiza resumo gerencial depois da confirmação", async () => {
  const reconciliar = vi.fn(async () => ({
    estado: "confirmado" as const,
    resultado: {
      chamadoId: pedido.chamadoId,
      osId: pedido.osId,
      requestId: pedido.requestId,
      revision: 2,
      numero: "OS-1",
    },
  }));
  const invalidar = montar({ consultarRevisao: async () => 2, criar: vi.fn(), reconciliar });
  const botao = await screen.findByRole("button", { name: "Consultar resultado do pedido" });
  await waitFor(() => expect(botao).toBeEnabled());
  fireEvent.click(botao);
  await waitFor(() => expect(sessionStorage.getItem(chave)).toBeNull());
  expect(reconciliar).toHaveBeenCalledWith(pedido);
  expect(invalidar).toHaveBeenCalledWith({ queryKey: ["s167-resumo-chamados", "usuario"] });
});

it("mantém tentativa indeterminada e não cria outra OS", async () => {
  const criar = vi.fn();
  montar({
    consultarRevisao: async () => 1,
    criar,
    reconciliar: async () => ({ estado: "indeterminado" }),
  });
  const botao = await screen.findByRole("button", { name: "Consultar resultado do pedido" });
  await waitFor(() => expect(botao).toBeEnabled());
  fireEvent.click(botao);
  expect(await screen.findByText(/Resultado indeterminado/)).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(pedido));
  expect(criar).not.toHaveBeenCalled();
});

it("não remove outra tentativa gravada durante a reconciliação", async () => {
  let concluir!: (r: {
    estado: "confirmado";
    resultado: {
      chamadoId: string;
      osId: string;
      requestId: string;
      revision: number;
      numero: string;
    };
  }) => void;
  const reconciliar = vi.fn(
    () =>
      new Promise<Parameters<typeof concluir>[0]>((resolve) => {
        concluir = resolve;
      }),
  );
  montar({ consultarRevisao: async () => 1, criar: vi.fn(), reconciliar });
  const botao = await screen.findByRole("button", { name: "Consultar resultado do pedido" });
  await waitFor(() => expect(botao).toBeEnabled());
  fireEvent.click(botao);
  await waitFor(() => expect(reconciliar).toHaveBeenCalledTimes(1));
  const outra = { ...pedido, osId: "16794000-0000-4000-8000-000000000099" };
  sessionStorage.setItem(chave, JSON.stringify(outra));
  concluir({
    estado: "confirmado",
    resultado: {
      chamadoId: pedido.chamadoId,
      osId: pedido.osId,
      requestId: pedido.requestId,
      revision: 2,
      numero: "OS-1",
    },
  });
  expect(await screen.findByText(/tentativa local mudou/)).toBeTruthy();
  expect(sessionStorage.getItem(chave)).toBe(JSON.stringify(outra));
});
