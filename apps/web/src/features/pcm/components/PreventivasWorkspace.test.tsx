// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ResultadoPreventivas } from "../application/preventivas-gateway";

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

const dados: ResultadoPreventivas = {
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
      envio_estado: "disponivel" as const,
      auvo_task_id: 123,
      tecnico_funcionario_id: null,
      erro_envio: null,
      resultado_estado: "nao_ok" as const,
      resultado_atualizado_em: "2026-10-10T12:00:00Z",
      os_numero: "CH-123",
      tecnico_nome: "Técnico A",
      auvo_task_url: "https://app.auvo.com.br/tarefa/123",
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

function renderWorkspace(
  props: Partial<React.ComponentProps<typeof PreventivasWorkspace>> = {},
  dadosPreventivas = dados,
) {
  listarPreventivas.mockResolvedValue(dadosPreventivas);
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

  it("mostra no histórico o resultado resumido e mantém o formulário completo no Auvo", async () => {
    renderWorkspace();
    expect(await screen.findByText("Histórico de execuções")).toBeInTheDocument();
    expect(screen.getByText("Resultado: Não OK")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir formulário no Auvo" })).toHaveAttribute(
      "href",
      "https://app.auvo.com.br/tarefa/123",
    );
  });

  it("filtra o histórico pelo resultado consolidado", async () => {
    const ocorrenciaBase = dados.ocorrencias[0];
    if (!ocorrenciaBase) throw new Error("Fixture de ocorrência ausente.");
    const ocorrenciaOk = {
      ...ocorrenciaBase,
      id: "ocorrencia-ok",
      auvo_task_id: 124,
      os_numero: "CH-124",
      resultado_estado: "ok" as const,
    };
    renderWorkspace({}, { ...dados, ocorrencias: [ocorrenciaBase, ocorrenciaOk] });

    expect(await screen.findByText("Histórico: 1–2 de 2")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Filtrar histórico por resultado"),
      "nao_ok",
    );

    expect(screen.getByText("Histórico: 1–1 de 1")).toBeInTheDocument();
    expect(screen.getByText(/OS CH-123/)).toBeInTheDocument();
    expect(screen.queryByText(/OS CH-124/)).not.toBeInTheDocument();
  });

  it("filtra o histórico pelo período da execução", async () => {
    const ocorrenciaBase = dados.ocorrencias[0];
    if (!ocorrenciaBase) throw new Error("Fixture de ocorrência ausente.");
    const agora = new Date();
    const antiga = new Date(agora);
    antiga.setDate(antiga.getDate() - 91);
    const ocorrenciaAntiga = {
      ...ocorrenciaBase,
      id: "ocorrencia-antiga",
      auvo_task_id: 125,
      os_numero: "CH-125",
      os_concluida_em: antiga.toISOString(),
    };
    const ocorrenciaRecente = {
      ...ocorrenciaBase,
      id: "ocorrencia-recente",
      os_numero: "CH-126",
      os_concluida_em: agora.toISOString(),
    };
    renderWorkspace({}, { ...dados, ocorrencias: [ocorrenciaAntiga, ocorrenciaRecente] });

    await screen.findByText("Histórico: 1–2 de 2");
    await userEvent.selectOptions(
      screen.getByLabelText("Filtrar histórico por período"),
      "30_dias",
    );

    expect(screen.getByText("Histórico: 1–1 de 1")).toBeInTheDocument();
    expect(screen.getByText(/OS CH-126/)).toBeInTheDocument();
    expect(screen.queryByText(/OS CH-125/)).not.toBeInTheDocument();
  });

  it("abre o detalhe da ocorrência ao selecioná-la no calendário", async () => {
    renderWorkspace();
    await userEvent.click(await screen.findByRole("button", { name: "Calendário" }));
    await userEvent.click(await screen.findByRole("button", { name: "Plano A: No Auvo" }));

    expect(await screen.findByText("Detalhe da preventiva")).toBeInTheDocument();
    expect(screen.getAllByText(/OS CH-123/)).toHaveLength(2);
  });

  it("pagina o histórico sem reduzir os eventos disponíveis no calendário", async () => {
    const ocorrenciaBase = dados.ocorrencias[0];
    if (!ocorrenciaBase) throw new Error("Fixture de ocorrência ausente.");
    const ocorrencias = Array.from({ length: 11 }, (_, indice) => ({
      ...ocorrenciaBase,
      id: `ocorrencia-${indice + 1}`,
      auvo_task_id: indice + 1,
      os_numero: `CH-${indice + 1}`,
      vencimento: `2026-10-${String(indice + 1).padStart(2, "0")}`,
    }));
    renderWorkspace({}, { ...dados, ocorrencias, avaliacoes: [] });

    expect(await screen.findByText("Histórico: 1–10 de 11")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Calendário" }));
    expect(screen.getAllByRole("button", { name: "Plano A: No Auvo" })).toHaveLength(11);
    expect(screen.getByText(/OS CH-11/)).toBeInTheDocument();
    expect(screen.queryByText(/OS CH-1 ·/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Próxima página do histórico" }));

    expect(screen.getByText("Histórico: 11–11 de 11")).toBeInTheDocument();
    expect(screen.getByText(/OS CH-1 ·/)).toBeInTheDocument();
  });

  it("expõe validação do contrato Auvo somente para superadmin", async () => {
    renderWorkspace({ podeValidarContratoAuvo: true });
    await userEvent.click(await screen.findByRole("button", { name: "Validar contrato Auvo" }));

    expect(await screen.findByText("Validação do contrato Auvo")).toBeInTheDocument();
  });
});
