// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CentralMateriais, CentralMateriaisGlobal } from "./Central";

const mocks = vi.hoisted(() => ({ consultar: vi.fn(), autorizar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } },
}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: mocks.autorizar },
}));
vi.mock("../../infrastructure/supabase-listas-materiais-adapter", () => ({
  supabaseListasMateriaisAdapter: { consultarCentral: mocks.consultar },
}));
vi.mock("./Workspace", () => ({ WorkspaceListasMateriais: () => null }));
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
