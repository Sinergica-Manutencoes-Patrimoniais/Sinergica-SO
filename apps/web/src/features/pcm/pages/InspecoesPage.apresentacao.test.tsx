// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InspecoesPage } from "./InspecoesPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "teste" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../infrastructure/supabase-qualidade-adapter", () => ({
  supabaseQualidadeAdapter: {
    listarClientes: async () => [{ id: "cliente", nome: "Cliente fictício" }],
    listarInspecoes: async () => [
      {
        id: "inspecao",
        titulo: "Inspeção fictícia",
        clienteNome: "Cliente fictício",
        dataInspecao: "2026-11-26",
        status: "em_andamento",
        totalItens: 0,
      },
    ],
    listarTiposInspecao: async () => [],
    listarTemplates: async () => [],
    listarItensInspecao: async () => [],
  },
}));

afterEach(cleanup);

it("anuncia a opção selecionada e aplica as cores de seleção ao mudar de sistema", async () => {
  render(<InspecoesPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Adicionar item" }));
  const grupo = screen.getByRole("group", { name: /Sistema \/ Área/ });
  const geral = within(grupo).getByRole("button", { name: "Geral", pressed: true });
  const equipamentos = within(grupo).getByRole("button", { name: "Equipamentos", pressed: false });
  expect(geral).toHaveClass("bg-info-soft", "text-info");
  fireEvent.click(equipamentos);
  expect(equipamentos).toHaveAttribute("aria-pressed", "true");
  expect(equipamentos).toHaveClass("bg-info-soft", "text-info");
  expect(geral).toHaveAttribute("aria-pressed", "false");
});
