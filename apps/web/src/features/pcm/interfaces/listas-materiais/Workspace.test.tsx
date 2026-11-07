// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceListasMateriais } from "./Workspace";

const servidor = vi.hoisted(() => ({ listas: [] as object[] }));
vi.mock("../../../../lib/supabase-client", () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } } }));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: { autorizarAcao: async () => true },
}));
vi.mock("../../infrastructure/supabase-listas-materiais-adapter", () => ({
  validarCriarListaMateriais: (entrada: unknown) => entrada,
  supabaseListasMateriaisAdapter: {
    listar: async () => [...servidor.listas],
    criar: async (comando: {
      listaId: string;
      ordemServicoId: string;
      responsavel: string;
      textoOriginal: string;
    }) => {
      servidor.listas.push({
        id: comando.listaId,
        ordem_servico_id: comando.ordemServicoId,
        responsavel: comando.responsavel,
        texto_original: comando.textoOriginal,
        estado: "levantada",
        revisao: 1,
      });
    },
  },
}));
vi.mock("./EditorPersistido", () => ({ EditorPersistido: () => null }));
vi.mock("./DisponibilidadeMateriais", () => ({ DisponibilidadeMateriais: () => null }));
vi.mock("./PublicarPortal", () => ({ PublicarPortal: () => null }));
vi.mock("./VisibilidadePortal", () => ({ VisibilidadePortal: () => null }));

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  servidor.listas = [];
});

it("atualiza a lista confirmada mesmo quando a limpeza da tentativa local falha", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new Error("armazenamento indisponível");
  });
  render(
    <QueryClientProvider client={client}>
      <WorkspaceListasMateriais usuario="usuario" cliente="cliente" ordemServico="os" />
    </QueryClientProvider>,
  );
  await screen.findByText("Nenhuma lista cadastrada nesta OS.");
  fireEvent.change(screen.getByLabelText(/Texto original/), { target: { value: "Duas lâmpadas" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar lista" }));
  expect(await screen.findByText("Duas lâmpadas")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tentar salvar novamente" })).toBeTruthy();
});
