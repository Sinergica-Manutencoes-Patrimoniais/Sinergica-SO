// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BacklogGutPage } from "./BacklogGutPage";

vi.mock("../../../lib/supabase-client", () => ({ supabase: {} }));
vi.mock("../../../app/auth-context", () => ({ useAuth: () => ({ user: { id: "pcm-ficticio" } }) }));
vi.mock("../../../app/permissoes-context", () => ({
  usePermissoes: () => ({ carregando: false, podeAcessar: () => true }),
}));
vi.mock("../interfaces/chamados-os/RecuperarConfirmacaoOs", () => ({
  RecuperarConfirmacaoOs: () => null,
}));
vi.mock("../components/NovaOrdemServicoModal", () => ({
  NovaOrdemServicoModal: ({ clienteInicialId }: { clienteInicialId?: string }) => (
    <output>{clienteInicialId ?? "Escolha o Cliente"}</output>
  ),
}));

it.each([
  ["todos", "Escolha o Cliente"],
  ["cliente-b", "cliente-b"],
])("DEF-43: abre cadastro de OS com contexto %s", (contexto, esperado) => {
  render(
    <BacklogGutPage
      clienteControladoId={contexto}
      clientesControlados={[
        { id: "cliente-a", nome: "Cliente de teste" },
        { id: "cliente-b", nome: "Cliente de teste" },
      ]}
      onAlterarCliente={vi.fn()}
      ordensControladas={[]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar OS para o backlog" }));
  expect(screen.getByText(esperado)).toBeInTheDocument();
});
