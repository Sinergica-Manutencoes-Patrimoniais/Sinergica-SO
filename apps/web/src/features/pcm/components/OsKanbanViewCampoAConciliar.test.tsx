// @vitest-environment jsdom
// E01-S199 — a coluna "Campo a conciliar" é fila de ENTRADA do Kanban (BL 007 AC-5 do Pacote
// Consolidado do Fabrício). O que estes testes travam:
//  1. a coluna existe e mostra o que o PCM precisa pra decidir sem abrir a OS;
//  2. gate fechado/flag desligada se ANUNCIA — não vira "Nada a conciliar", que é a mentira que
//     a regra de alcance no front (E00-S28 AC-F3) existe pra impedir;
//  3. clicar no cartão abre a triagem da tarefa Auvo.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ItemCampoAConciliar } from "../domain/campo-a-conciliar";
import { COLUNAS_KANBAN_PADRAO } from "../domain/kanban-colunas";
import { OsKanbanView } from "./OsKanbanView";

const ITEM: ItemCampoAConciliar = {
  osId: "11111111-1111-4111-8111-111111111111",
  chamadoId: "22222222-2222-4222-8222-222222222222",
  osNumero: "OS-2026-0042",
  chamadoNumero: "CH-2026-0042",
  titulo: "Bomba parada no barrilete",
  motivo: "referencia_ausente",
  taskId: 987654,
  statusOs: "em_execucao",
  criadoEm: "2026-11-19T10:00:00Z",
};

function montar(extra: Partial<Parameters<typeof OsKanbanView>[0]> = {}) {
  return render(
    <OsKanbanView
      ordens={[]}
      temEscrita
      salvando={false}
      onAlterarStatus={() => {}}
      onSelecionar={() => {}}
      onTriarCampo={() => {}}
      colunas={COLUNAS_KANBAN_PADRAO}
      onMoverColuna={() => {}}
      onAlternarVisibilidadeColuna={() => {}}
      preventivas={[]}
      {...extra}
    />,
  );
}

describe("OsKanbanView — Campo a conciliar (E01-S199)", () => {
  it("mostra a coluna com o motivo e a tarefa Auvo de origem", () => {
    montar({ camposAConciliar: [ITEM] });
    expect(screen.getByText("Campo a conciliar")).toBeInTheDocument();
    expect(screen.getByText("Bomba parada no barrilete")).toBeInTheDocument();
    // O motivo é o que diz ao PCM POR QUE a OS caiu na fila.
    expect(screen.getByText("Sem referência de Chamado")).toBeInTheDocument();
    expect(screen.getByText("Tarefa Auvo 987654")).toBeInTheDocument();
    expect(screen.getByText("OS-2026-0042 · CH-2026-0042")).toBeInTheDocument();
  });

  it("fila vazia diz 'Nada a conciliar' — só quando está mesmo vazia", () => {
    montar({ camposAConciliar: [] });
    expect(screen.getByText("Nada a conciliar")).toBeInTheDocument();
  });

  it("recurso não ativado se anuncia e NÃO se disfarça de fila vazia", () => {
    montar({
      camposAConciliar: [],
      avisoCampoAConciliar: "Campo a conciliar: recurso disponível, ainda não ativado.",
    });
    expect(
      screen.getByText("Campo a conciliar: recurso disponível, ainda não ativado."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nada a conciliar")).not.toBeInTheDocument();
  });

  it("sem capacidade de validação, diz isso — não mostra erro genérico", () => {
    montar({
      camposAConciliar: [],
      avisoCampoAConciliar:
        "Campo a conciliar: você não tem a capacidade de validação neste Cliente.",
    });
    expect(
      screen.getByText("Campo a conciliar: você não tem a capacidade de validação neste Cliente."),
    ).toBeInTheDocument();
  });

  it("clicar no cartão da fila abre a triagem com o contexto da tarefa", async () => {
    const onSelecionar = vi.fn();
    const onTriarCampo = vi.fn();
    montar({ camposAConciliar: [ITEM], onSelecionar, onTriarCampo });
    await userEvent.click(screen.getByText("Bomba parada no barrilete"));
    expect(onTriarCampo).toHaveBeenCalledWith(ITEM);
    expect(onSelecionar).not.toHaveBeenCalled();
  });

  it("motivo desconhecido não some da tela — cai num rótulo legível", () => {
    montar({ camposAConciliar: [{ ...ITEM, motivo: "motivo_que_ainda_nao_existe" }] });
    expect(screen.getByText("Sem referência de Chamado")).toBeInTheDocument();
  });
});
