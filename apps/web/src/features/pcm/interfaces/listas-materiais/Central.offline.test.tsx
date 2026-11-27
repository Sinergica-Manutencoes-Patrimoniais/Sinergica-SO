// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CentralMateriais, CentralMateriaisGlobal } from "./Central";
import { buscaOsCentralMateriaisOptions } from "./busca-os-central-materiais-queries";

const { buscarOsCentral, getUser, autorizarAcao } = vi.hoisted(() => ({
  buscarOsCentral: vi.fn(),
  getUser: vi.fn(),
  autorizarAcao: vi.fn(),
}));
const usuario = "usuario-ficticio";
const cliente = "cliente-ficticio";
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao },
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

async function pausarBusca(global = false) {
  autorizarAcao.mockResolvedValue(true);
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_BUSCA_OS_MATERIAIS_ENABLED", "true");
  getUser.mockResolvedValue({ data: { user: { id: usuario } }, error: null });
  buscarOsCentral.mockImplementation(async (_cliente: string, busca: string) =>
    busca ? [{ id: "os-ficticia", numero: "CH-9901", titulo: "Troca de fusível" }] : [],
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Central = global ? CentralMateriaisGlobal : CentralMateriais;
  const montar = (u: string, c: string) => (
    <QueryClientProvider client={client}>
      <Central usuario={u} cliente={c} />
    </QueryClientProvider>
  );
  const view = render(montar(usuario, cliente));
  if (global)
    fireEvent.click(await screen.findByRole("button", { name: "Abrir Central de materiais" }));
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
  return { seletor, client, trocarContexto: (u: string, c: string) => view.rerender(montar(u, c)) };
}

describe("estado da busca de OS offline (DEF-26)", () => {
  it("pausa sem consultar o servidor e retoma ao reconectar", async () => {
    const { seletor } = await pausarBusca();
    expect(buscarOsCentral).toHaveBeenCalledTimes(1);
    act(() => onlineManager.setOnline(true));
    expect(await seletor.findByRole("button", { name: "Selecionar CH-9901" })).toBeVisible();
  });

  it("explica que a busca aguarda a conexão", async () => {
    const { seletor } = await pausarBusca();
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

it("retoma o termo submetido após revalidação que desmonta a Central global", async () => {
  const { client } = await pausarBusca(true);
  let autorizar: ((valor: boolean) => void) | undefined;
  autorizarAcao.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        autorizar = resolve;
      }),
  );
  act(() => {
    void client.invalidateQueries({
      queryKey: ["listas-materiais-central", usuario, cliente, "permissao"],
    });
  });
  act(() => onlineManager.setOnline(true));
  await screen.findByText("Verificando acesso aos materiais…");
  expect(
    screen.queryByRole("region", { name: "Selecionar OS com materiais" }),
  ).not.toBeInTheDocument();
  await waitFor(() => expect(autorizar).toBeTypeOf("function"));
  act(() => autorizar?.(true));
  expect(await screen.findByRole("button", { name: "Selecionar CH-9901" })).toBeVisible();
  expect(screen.getByLabelText("Número da OS")).toHaveValue("CH-9901");
});

it.each(["negado", "erro"])("mantém a busca oculta após revalidação com %s", async (falha) => {
  const { client } = await pausarBusca(true);
  if (falha === "negado") autorizarAcao.mockResolvedValueOnce(false);
  else autorizarAcao.mockRejectedValueOnce(new Error("Falha de acesso"));
  act(() => {
    void client.invalidateQueries({
      queryKey: ["listas-materiais-central", usuario, cliente, "permissao"],
    });
  });
  act(() => onlineManager.setOnline(true));
  expect(
    await screen.findByText(
      falha === "negado"
        ? "Sem permissão para consultar materiais deste Cliente."
        : "Não foi possível verificar acesso.",
    ),
  ).toBeVisible();
  expect(
    screen.queryByRole("region", { name: "Selecionar OS com materiais" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/CH-9901/)).not.toBeInTheDocument();
  if (falha === "erro") {
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("button", { name: "Selecionar CH-9901" })).toBeVisible();
    expect(screen.getByLabelText("Número da OS")).toHaveValue("CH-9901");
  }
});

it.each([
  [usuario, "outro-cliente"],
  ["outro-usuario", cliente],
])("descarta a busca pausada ao trocar para %s / %s", async (novoUsuario, novoCliente) => {
  const { trocarContexto } = await pausarBusca(true);
  getUser.mockResolvedValue({ data: { user: { id: novoUsuario } }, error: null });
  trocarContexto(novoUsuario, novoCliente);
  act(() => onlineManager.setOnline(true));
  fireEvent.click(await screen.findByRole("button", { name: "Abrir Central de materiais" }));
  expect(await screen.findByText("Nenhuma OS com lista encontrada.")).toBeVisible();
  expect(screen.getByLabelText("Número da OS")).toHaveValue("");
  expect(screen.queryByText(/CH-9901/)).not.toBeInTheDocument();
  expect(buscarOsCentral).toHaveBeenLastCalledWith(
    novoCliente,
    "",
    20,
    null,
    expect.any(AbortSignal),
  );
  expect(buscarOsCentral.mock.calls.some(([, termo]) => termo === "CH-9901")).toBe(false);
});
