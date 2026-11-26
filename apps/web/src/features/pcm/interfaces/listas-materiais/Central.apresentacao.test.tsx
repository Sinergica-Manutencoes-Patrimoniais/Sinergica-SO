// @vitest-environment jsdom
// DEF-09: a Central de materiais era markup cru — nenhum filtro, rótulo ou ação tinha classe,
// e a tela aparecia como texto corrido, sem distinção visual entre filtro, ação e conteúdo.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CentralMateriais } from "./Central";

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

async function montar() {
  vi.stubEnv("VITE_SSO_CENTRAL_MATERIAIS_ENABLED", "true");
  mocks.autorizar.mockResolvedValue(true);
  mocks.consultar.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CentralMateriais usuario="usuario" cliente="cliente" />
    </QueryClientProvider>,
  );
  return await screen.findByRole("region", { name: "Central de materiais" });
}

it("apresenta a central como superfície, não como texto corrido", async () => {
  const secao = await montar();
  expect(secao.className).toMatch(/\bborder-line\b/);
  expect(secao.className).toMatch(/\bbg-card\b/);
});

it("os controles de filtro usam a forma de campo do produto", async () => {
  await montar();
  const os = screen.getByLabelText("Identificador da OS");
  const responsavel = screen.getByLabelText("Responsável");
  expect(os.className.split(/\s+/)).toContain("input");
  expect(responsavel.className.split(/\s+/)).toContain("input");
});

it("a ação de filtrar é um botão do produto, não um botão cru", async () => {
  await montar();
  const filtrar = screen.getByRole("button", { name: "Filtrar OS" });
  // <Button> de @sinergica/ui: forma própria, nunca o botão sem classe do navegador.
  expect(filtrar.className).toMatch(/\brounded-md\b/);
  expect(filtrar.className).toMatch(/\bfont-semibold\b/);
});
