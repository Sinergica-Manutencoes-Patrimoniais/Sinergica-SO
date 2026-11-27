// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CentralMateriais, CentralMateriaisGlobal } from "./Central";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), autorizar: vi.fn(), buscar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: mocks.autorizar },
}));
vi.mock("../../infrastructure/supabase-listas-materiais-adapter", () => ({
  supabaseListasMateriaisAdapter: {
    consultarCentral: mocks.consultar,
    buscarOsCentral: mocks.buscar,
  },
}));
vi.mock("./Workspace", () => ({
  WorkspaceListasMateriais: ({
    rascunho,
    onAlterarRascunho,
  }: {
    rascunho?: { texto: string; responsavel: string };
    onAlterarRascunho: (rascunho: { texto: string; responsavel: string }) => void;
  }) => (
    <input
      aria-label="Texto da OS"
      value={rascunho?.texto ?? ""}
      onChange={(e) => onAlterarRascunho({ texto: e.target.value, responsavel: "sinergica" })}
    />
  ),
}));
vi.mock("./ExcecoesOs", () => ({ ExcecoesOs: () => null }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("mantém listas carregadas e permite repetir página que falhou", async () => {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  mocks.autorizar.mockResolvedValue(true);
  const primeira = Array.from({ length: 20 }, (_, i) => ({
    id: `17900000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    ordem_servico_id: "17900000-0000-4000-8000-000000000099",
    responsavel: "cliente",
    estado: "levantada",
    revisao: 1,
    texto_original: `Material ${i + 1}`,
  }));
  mocks.consultar
    .mockResolvedValueOnce(primeira)
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce([
      { ...primeira[0], id: "17900000-0000-4000-8000-000000000021", texto_original: "Material 21" },
    ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CentralMateriais usuario="usuario" cliente="cliente" />
    </QueryClientProvider>,
  );
  await screen.findByText("Material 1");
  fireEvent.click(screen.getByRole("button", { name: "Carregar mais listas" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Material 1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
  expect(await screen.findByText("Material 21")).toBeTruthy();
  expect(screen.getByText("Material 1")).toBeTruthy();
});

it("oculta listas anteriores quando acesso é negado na próxima página", async () => {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  mocks.autorizar.mockResolvedValue(true);
  const primeira = Array.from({ length: 20 }, (_, i) => ({
    id: `17900000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    ordem_servico_id: "17900000-0000-4000-8000-000000000099",
    responsavel: "cliente",
    estado: "levantada",
    revisao: 1,
    texto_original: `Material ${i + 1}`,
  }));
  mocks.consultar
    .mockResolvedValueOnce(primeira)
    .mockRejectedValueOnce({ code: "42501", message: "sem_acesso" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CentralMateriais usuario="usuario" cliente="cliente" />
    </QueryClientProvider>,
  );
  await screen.findByText("Material 1");
  fireEvent.click(screen.getByRole("button", { name: "Carregar mais listas" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Material 1")).toBeNull();
});

it("abre central no Cliente selecionado e fecha ao mudar o Cliente", async () => {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  mocks.autorizar.mockResolvedValue(true);
  mocks.consultar.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tela = render(
    <QueryClientProvider client={client}>
      <CentralMateriaisGlobal usuario="usuario" cliente="cliente-a" />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Abrir Central de materiais" }));
  expect(await screen.findByText("Nenhuma lista para estes filtros.")).toBeTruthy();
  tela.rerender(
    <QueryClientProvider client={client}>
      <CentralMateriaisGlobal usuario="usuario" cliente="cliente-b" />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("region", { name: "Central de materiais" })).toBeNull();
  expect(await screen.findByRole("button", { name: "Abrir Central de materiais" })).toBeTruthy();
});

it("não oferece a central global quando a permissão é negada", async () => {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  mocks.autorizar.mockResolvedValue(false);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CentralMateriaisGlobal usuario="usuario" cliente="cliente-a" />
    </QueryClientProvider>,
  );
  await screen.findByText("Sem permissão para consultar materiais deste Cliente.");
  expect(screen.queryByRole("button", { name: "Abrir Central de materiais" })).toBeNull();
});

it("permite abrir a OS de uma lista na Central global", async () => {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  mocks.autorizar.mockResolvedValue(true);
  const os = "17900000-0000-4000-8000-000000000099";
  mocks.consultar.mockResolvedValue([
    {
      id: "17900000-0000-4000-8000-000000000001",
      ordem_servico_id: os,
      responsavel: "cliente",
      estado: "levantada",
      revisao: 1,
      texto_original: "Lâmpadas",
    },
  ]);
  const abrir = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CentralMateriaisGlobal usuario="usuario" cliente="cliente" onAbrirOs={abrir} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Abrir Central de materiais" }));
  fireEvent.click(await screen.findByRole("button", { name: "Abrir contexto da OS" }));
  expect(abrir).toHaveBeenCalledWith(os);
});

// E01-S179 AC-7: aquisição e estados terminais não desaparecem no filtro.
it("oferece os sete estados de materiais na entrada única", async () => {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  mocks.autorizar.mockResolvedValue(true);
  mocks.consultar.mockResolvedValue([]);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CentralMateriais usuario="usuario" cliente="cliente" />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("option", { name: "Aguardando aquisição" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Dispensada" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Concluída" })).toBeTruthy();
});

it("DEF-25: restaura o texto depois de ocultar a Central para revalidar permissão", async () => {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_LISTAS_MATERIAIS_ENABLED", "true");
  mocks.consultar.mockResolvedValue([
    {
      id: "lista-ficticia",
      ordem_servico_id: "os-ficticia",
      responsavel: "cliente",
      estado: "levantada",
      revisao: 1,
      texto_original: "Material já registrado",
    },
  ]);
  mocks.autorizar.mockResolvedValue(true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const relatar = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <CentralMateriais usuario="usuario" cliente="cliente" onRascunhoAlterado={relatar} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Abrir materiais da OS" }));
  fireEvent.change(screen.getByLabelText("Texto da OS"), {
    target: { value: "Rascunho fictício" },
  });
  let autorizar!: (permitido: boolean) => void;
  mocks.autorizar.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        autorizar = resolve;
      }),
  );
  void client.invalidateQueries({
    queryKey: ["listas-materiais-central", "usuario", "cliente", "permissao"],
  });
  await screen.findByText("Verificando acesso aos materiais…");
  expect(screen.queryByLabelText("Texto da OS")).toBeNull();
  expect(relatar).toHaveBeenLastCalledWith(true);
  await act(async () => autorizar(true));
  expect(await screen.findByLabelText("Texto da OS")).toHaveValue("Rascunho fictício");
});

it("mostra o número resolvido pelo seletor mediado sem imprimir o ID da OS", async () => {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_BUSCA_OS_MATERIAIS_ENABLED", "true");
  const id = "17900000-0000-4000-8000-000000000099";
  mocks.autorizar.mockResolvedValue(true);
  mocks.buscar.mockResolvedValue([{ id, numero: "CH-MATERIAL", titulo: "OS fictícia" }]);
  mocks.consultar.mockResolvedValue([
    {
      id: "lista",
      ordem_servico_id: id,
      responsavel: "cliente",
      estado: "concluida",
      revisao: 3,
      texto_original: "Material fictício",
    },
  ]);
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <CentralMateriais usuario="usuario" cliente="cliente" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("OS CH-MATERIAL · Cliente · Concluída · revisão 3")).toBeVisible();
  expect(container).not.toHaveTextContent(id);
  expect(mocks.buscar).toHaveBeenCalledWith("cliente", "", 20, null, expect.any(AbortSignal));
});
