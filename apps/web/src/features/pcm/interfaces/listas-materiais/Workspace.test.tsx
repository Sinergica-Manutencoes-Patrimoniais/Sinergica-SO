// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceListasMateriais } from "./Workspace";

const servidor = vi.hoisted(() => ({ listas: [] as object[], criar: vi.fn() }));
vi.mock("../../../../lib/supabase-client", () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) } },
}));
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
      await servidor.criar(comando);
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
  servidor.criar.mockReset();
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
  expect(screen.queryByRole("button", { name: "Tentar salvar novamente" })).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent(/Lista salva/);
  expect(screen.queryByRole("button", { name: "Registrar lista" })).toBeNull();
  expect(servidor.criar).toHaveBeenCalledTimes(1);
});

it("só permite repetir uma gravação incerta e conserva o mesmo comando", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let rejeitar!: (motivo: Error) => void;
  servidor.criar.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejeitar = reject;
      }),
  );
  render(
    <QueryClientProvider client={client}>
      <WorkspaceListasMateriais usuario="usuario" cliente="cliente" ordemServico="os" />
    </QueryClientProvider>,
  );
  await screen.findByText("Nenhuma lista cadastrada nesta OS.");
  fireEvent.change(screen.getByLabelText(/Texto original/), { target: { value: "Duas lâmpadas" } });
  const registrar = screen.getByRole("button", { name: "Registrar lista" });
  fireEvent.click(registrar);
  fireEvent.click(registrar);
  expect(await screen.findByText("Salvando lista…")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tentar salvar novamente" })).toBeNull();
  await vi.waitFor(() => expect(servidor.criar).toHaveBeenCalledTimes(1));

  rejeitar(new Error("Conexão interrompida"));
  const repetir = await screen.findByRole("button", { name: "Tentar salvar novamente" });
  fireEvent.click(repetir);
  fireEvent.click(repetir);
  expect(await screen.findByText("Duas lâmpadas")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tentar salvar novamente" })).toBeNull();
  expect(servidor.criar).toHaveBeenCalledTimes(2);
  expect(servidor.criar.mock.calls[1]).toEqual(servidor.criar.mock.calls[0]);
});
