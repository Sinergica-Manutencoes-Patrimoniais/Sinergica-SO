// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OcorrenciaPreventiva, PlanoPreventivo } from "../application/preventivas-gateway";
import { PreventivaDetalheDrawer } from "./PreventivaDetalheDrawer";

const plano: PlanoPreventivo = {
  id: "plano-1",
  nome: "Extintores",
  estado: "ativo",
  primeira_data: "2026-01-10",
  intervalo_unidade: "meses",
  intervalo_n: 1,
  cliente_id: "cliente-1",
  sistema_id: null,
  equipamento_id: "equipamento-1",
  questionario_id: "questionario-1",
  tipo_tarefa_id: "tipo-1",
  alvo_nome: "Extintor hall",
};

const ocorrencia: OcorrenciaPreventiva = {
  id: "ocorrencia-1",
  plano_id: "plano-1",
  vencimento: "2026-10-10",
  visita_em: "2026-10-11T10:00:00Z",
  envio_estado: "disponivel",
  auvo_task_id: 123,
  tecnico_funcionario_id: "tecnico-1",
  tecnico_nome: "Ana Técnica",
  erro_envio: null,
  resultado_estado: "ok",
  resultado_atualizado_em: "2026-10-11T12:00:00Z",
  os_id: "os-1",
  os_numero: "CH-123",
  os_concluida_em: "2026-10-11T12:00:00Z",
  auvo_task_url: "https://app.auvo.com.br/tarefa/123",
};

describe("PreventivaDetalheDrawer — E01-S163 AC-11 e AC-12", () => {
  it("mostra contexto da ocorrência, plano, próximas ocorrências e OS associada", () => {
    render(
      <PreventivaDetalheDrawer
        ocorrencia={ocorrencia}
        plano={plano}
        ocorrenciasDoPlano={[
          ocorrencia,
          { ...ocorrencia, id: "ocorrencia-2", vencimento: "2026-11-10", visita_em: null },
        ]}
        temEscrita
        onClose={vi.fn()}
        onConfirmarVisita={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Detalhe da preventiva Extintores")).toBeInTheDocument();
    expect(screen.getByText("OS CH-123")).toBeInTheDocument();
    expect(screen.getByText("Próximas ocorrências")).toBeInTheDocument();
    expect(screen.getByText(/A cada 1 meses/)).toBeInTheDocument();
  });

  it("fecha pelo controle explícito", async () => {
    const onClose = vi.fn();
    render(
      <PreventivaDetalheDrawer
        ocorrencia={ocorrencia}
        plano={plano}
        ocorrenciasDoPlano={[ocorrencia]}
        temEscrita={false}
        onClose={onClose}
        onConfirmarVisita={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fechar detalhe da preventiva" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("AC-12: apresenta o plano mesmo antes de materializar ocorrências", () => {
    render(
      <PreventivaDetalheDrawer
        plano={plano}
        ocorrenciasDoPlano={[]}
        temEscrita={false}
        onClose={vi.fn()}
        onConfirmarVisita={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Detalhe do plano preventivo Extintores" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Não há próximas ocorrências materializadas.")).toBeInTheDocument();
    expect(screen.getByText("Ainda não há execução concluída neste plano.")).toBeInTheDocument();
  });
});
