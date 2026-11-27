// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CentralMateriais } from "./Central";
import { buscaOsCentralMateriaisOptions } from "./busca-os-central-materiais-queries";

const { buscarOsCentral, getUser } = vi.hoisted(() => ({
  buscarOsCentral: vi.fn(),
  getUser: vi.fn(),
}));
const usuario = "usuario-ficticio";
const cliente = "cliente-ficticio";
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: async () => true },
}));
vi.mock("../../infrastructure/supabase-listas-materiais-adapter", () => ({
  supabaseListasMateriaisAdapter: { buscarOsCentral, consultarCentral: async () => [] },
}));
vi.mock("./Workspace", () => ({ WorkspaceListasMateriais: () => null }));
vi.mock("./ExcecoesOs", () => ({ ExcecoesOs: () => null }));

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

async function pausarBusca() {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_BUSCA_OS_MATERIAIS_ENABLED", "true");
  getUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null });
  buscarOsCentral.mockImplementation(async (_cliente: string, busca: string) =>
    busca ? [{ id: "os-ficticia", numero: "CH-9901", titulo: "Troca de fusível" }] : [],
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CentralMateriais usuario={usuario} cliente={cliente} />
    </QueryClientProvider>,
  );
  const seletor = within(
    await screen.findByRole("region", { name: "Selecionar OS com materiais" }),
  );
  await seletor.findByText("Nenhuma OS com lista encontrada.");
  act(() => onlineManager.setOnline(false));
  fireEvent.change(seletor.getByLabelText("Número da OS"), { target: { value: "CH-9901" } });
  fireEvent.click(seletor.getByRole("button", { name: "Buscar OS" }));
  await waitFor(() => {
    const busca = buscaOsCentralMateriaisOptions(usuario, cliente, "CH-9901");
    expect(client.getQueryState(busca.queryKey)?.fetchStatus).toBe("paused");
  });
  return seletor;
}

describe("estado da busca de OS offline (DEF-26)", () => {
  it("pausa sem consultar o servidor e retoma ao reconectar", async () => {
    const seletor = await pausarBusca();
    expect(buscarOsCentral).toHaveBeenCalledTimes(1);
    act(() => onlineManager.setOnline(true));
    expect(await seletor.findByRole("button", { name: "Selecionar CH-9901" })).toBeVisible();
  });

  it.fails("explica que a busca aguarda a conexão", async () => {
    const seletor = await pausarBusca();
    expect(seletor.getByRole("status")).toHaveTextContent(
      /offline|sem conexão|aguardando conexão/i,
    );
  });
});

it("descarta a resposta autorizada se a sessão trocar durante a requisição", async () => {
  getUser
    .mockResolvedValueOnce({ data: { user: { id: usuario } }, error: null })
    .mockResolvedValueOnce({ data: { user: { id: "outro" } }, error: null });
  buscarOsCentral.mockResolvedValue([{ id: "os-ficticia", numero: "CH-9901", titulo: "Fusível" }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await expect(
    client.fetchInfiniteQuery(buscaOsCentralMateriaisOptions(usuario, cliente, "")),
  ).rejects.toThrow("Sessão alterada.");
  expect(buscarOsCentral).toHaveBeenCalledWith(cliente, "", 20, null, expect.any(AbortSignal));
});
