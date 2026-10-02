// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { listarPreventivas, listarCatalogoPreventivas } = vi.hoisted(() => ({
  listarPreventivas: vi.fn(),
  listarCatalogoPreventivas: vi.fn(),
}));

vi.mock("../infrastructure/supabase-preventivas-adapter", () => ({
  listarPreventivas,
  listarCatalogoPreventivas,
}));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { schema: vi.fn(), functions: { invoke: vi.fn() } },
}));

import { PreventivasWorkspace } from "./PreventivasWorkspace";

const dados = {
  planos: [
    {
      id: "plano-a",
      nome: "Plano A",
      estado: "ativo" as const,
      primeira_data: "2026-10-10",
      intervalo_unidade: "meses" as const,
      intervalo_n: 1,
      cliente_id: "cliente-a",
      sistema_id: null,
      equipamento_id: "equipamento-a",
      questionario_id: "q-1",
      tipo_tarefa_id: "t-1",
    },
  ],
  ocorrencias: [
    {
      id: "ocorrencia-a",
      plano_id: "plano-a",
      vencimento: "2026-10-10",
      visita_em: null,
      envio_estado: "prevista" as const,
      auvo_task_id: null,
      tecnico_funcionario_id: null,
      erro_envio: null,
    },
  ],
  avaliacoes: [
    {
      id: "avaliacao-a",
      ocorrencia_id: "ocorrencia-a",
      item_referencia: "Item A",
      local_informado: null,
      resposta: { pergunta: "Está conforme?", valor: "Não" },
    },
  ],
};

function renderWorkspace(props: Partial<React.ComponentProps<typeof PreventivasWorkspace>> = {}) {
  listarPreventivas.mockResolvedValue(dados);
  listarCatalogoPreventivas.mockResolvedValue({
    clientes: [{ id: "cliente-a", nome: "Cliente A" }],
    sistemas: [{ id: "sistema-a", nome: "Sistema A", cliente_id: "cliente-a" }],
    equipamentos: [{ id: "equipamento-a", nome: "Equipamento A", client_id: "cliente-a" }],
    questionarios: [{ id: "q-1", nome: "Questionário" }],
    tipos: [{ id: "t-1", nome: "Preventiva" }],
    tecnicos: [{ id: "tecnico-a", nome: "Técnico A" }],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PreventivasWorkspace temEscrita userId="user-1" {...props} />
    </QueryClientProvider>,
  );
}

describe("PreventivasWorkspace — E01-S53 AC-8", () => {
  it("fixa cliente e limita alvos no 360", async () => {
    renderWorkspace({ clienteId: "cliente-a", clienteNome: "Cliente A" });
    expect((await screen.findAllByText("Plano A")).length).toBeGreaterThan(0);
    expect(listarPreventivas).toHaveBeenCalledWith({ clienteId: "cliente-a" });

    await userEvent.click(screen.getByRole("button", { name: "Novo plano" }));
    expect(await screen.findByText("Cliente: Cliente A")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cliente")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Equipamento A" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Cliente B" })).not.toBeInTheDocument();
    expect(listarCatalogoPreventivas).toHaveBeenCalledWith({ clienteId: "cliente-a" });
  });

  it("mantém seletor global e esconde todas as mutações sem escrita", async () => {
    renderWorkspace({ temEscrita: false });
    expect((await screen.findAllByText("Plano A")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Novo plano" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pausar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar visita" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar ao backlog" })).not.toBeInTheDocument();

    renderWorkspace();
    await userEvent.click(await screen.findByRole("button", { name: "Novo plano" }));
    expect(await screen.findByLabelText("Cliente")).toBeInTheDocument();
  });

  it("pede confirmação no produto antes de enviar achado ao backlog", async () => {
    renderWorkspace();
    await userEvent.click(await screen.findByRole("button", { name: "Enviar ao backlog" }));

    expect(await screen.findByText("Enviar achado ao backlog")).toBeInTheDocument();
  });
});
