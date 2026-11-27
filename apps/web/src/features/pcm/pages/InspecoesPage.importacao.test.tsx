// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InspecoesPage } from "./InspecoesPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "teste" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../infrastructure/supabase-qualidade-adapter", () => ({
  supabaseQualidadeAdapter: {
    listarClientes: async () => [],
    listarInspecoes: async () => [],
    listarTiposInspecao: async () => [],
    listarTemplates: async () => [],
  },
}));

afterEach(cleanup);

it.each([
  ["PDF", "PDF"],
  ["XLS", "XLS (Auvo)"],
])("identifica a ação de importar %s antes de abrir o diálogo", async (botao, titulo) => {
  render(<InspecoesPage />);
  fireEvent.click(await screen.findByRole("button", { name: `Importar ${botao}` }));
  expect(screen.getByText(`Importar Relatório ${titulo}`)).toBeVisible();
});
