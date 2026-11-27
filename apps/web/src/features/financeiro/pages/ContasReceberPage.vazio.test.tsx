// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ContasReceberPage } from "./ContasReceberPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "teste" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../application/contratos", () => ({ listarAgingRecebiveis: async () => [] }));
vi.mock("../application/lancamentos", () => ({
  listarClientesOpcoes: async () => [],
  baixarLancamento: vi.fn(),
}));

it("mostra um estado vazio próprio na visão por faixa", async () => {
  render(<ContasReceberPage />);
  const vazio = await screen.findByText("Nenhuma conta a receber em aberto.");
  expect(vazio).toBeVisible();
  expect(screen.getByRole("button", { name: "Por faixa", pressed: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Por cliente", pressed: false }));
  expect(screen.getByRole("button", { name: "Por cliente", pressed: true })).toBeVisible();
  expect(vazio).not.toBeInTheDocument();
});
