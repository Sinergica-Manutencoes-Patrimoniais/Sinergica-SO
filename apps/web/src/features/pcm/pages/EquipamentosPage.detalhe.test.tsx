// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listar: vi.fn(), clientes: vi.fn(), contexto: vi.fn() }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../application/equipamentos", () => ({
  listarEquipamentos: api.listar,
  listarClientesEquipamento: api.clientes,
  obterContextoItem: api.contexto,
  criarEquipamento: vi.fn(),
  editarEquipamento: vi.fn(),
  desativarEquipamento: vi.fn(),
}));
vi.mock("../infrastructure/supabase-equipamentos-adapter", () => ({
  supabaseEquipamentosAdapter: {},
}));
vi.mock("../infrastructure/supabase-identificador-ativo-adapter", () => ({
  supabaseIdentificadorAtivoAdapter: {},
}));
vi.mock("../infrastructure/supabase-capacidades-sso-adapter", () => ({
  supabaseCapacidadesSsoAdapter: {},
}));
vi.mock("../components/EquipamentoModal", () => ({ EquipamentoModal: () => null }));
vi.mock("../interfaces/estrutura-tecnica/HistoricoGrupo", () => ({ HistoricoGrupo: () => null }));
vi.mock("../interfaces/estrutura-tecnica/MovimentacaoDetalhe", () => ({
  MovimentacaoDetalhe: ({ onConcluido }: { onConcluido: () => void }) => (
    <button type="button" onClick={onConcluido}>
      Simular movimentação concluída
    </button>
  ),
}));
import { EquipamentosPage } from "./EquipamentosPage";

const item = {
  id: "item-1",
  nome: "Bomba",
  ativo: true,
  tipo: "componente",
  clientId: "cliente-1",
  estruturaRevisao: 1,
};
const contexto = (nome: string) => ({
  item: { ...item, nome },
  breadcrumb: null,
  sistemas: [],
  componentesFilhos: [],
});
function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EquipamentosPage />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.stubEnv("VITE_SSO_CAPACIDADE_CADASTRO_LEGADO_ENABLED", "false");
  api.listar.mockResolvedValue([item]);
  api.clientes.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

it("informa falha após movimentação e permite consultar novamente", async () => {
  api.contexto
    .mockResolvedValueOnce(contexto("Antes"))
    .mockRejectedValueOnce(new Error("indisponível"))
    .mockResolvedValueOnce(contexto("Depois"));
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Detalhe" }));
  await screen.findByRole("heading", { name: "Antes" });
  fireEvent.click(screen.getByRole("button", { name: "Simular movimentação concluída" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar o detalhe");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByRole("heading", { name: "Depois" })).toBeTruthy();
  expect(api.contexto).toHaveBeenCalledTimes(3);
});

it("não mostra resultado antigo depois de fechar e abrir o detalhe novamente", async () => {
  let resolver: (valor: ReturnType<typeof contexto>) => void = () => {};
  api.contexto
    .mockResolvedValueOnce(contexto("Antes"))
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    )
    .mockResolvedValueOnce(contexto("Atual"));
  montar();
  fireEvent.click(await screen.findByRole("button", { name: "Detalhe" }));
  await screen.findByRole("heading", { name: "Antes" });
  fireEvent.click(screen.getByRole("button", { name: "Simular movimentação concluída" }));
  await waitFor(() => expect(api.contexto).toHaveBeenCalledTimes(2));
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Detalhe" }));
  await screen.findByRole("heading", { name: "Atual" });
  await act(async () => {
    resolver(contexto("Obsoleto"));
  });
  expect(screen.getByRole("heading", { name: "Atual" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Obsoleto" })).toBeNull();
});
