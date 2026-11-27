// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { OcorrenciaPreventiva, PlanoPreventivo } from "../application/preventivas-gateway";
import { PreventivaDetalheDrawer } from "./PreventivaDetalheDrawer";
import { PreventivasListaView } from "./PreventivasListaView";
import { PreventivasTimelineView } from "./PreventivasTimelineView";

vi.mock("../application/cliente-360-telemetria", () => ({
  registrarEventoCliente360: vi.fn(),
}));

const plano: PlanoPreventivo = {
  id: "plano",
  nome: "Bomba fictícia",
  estado: "pausado",
  primeira_data: "2027-11-26",
  intervalo_unidade: "meses",
  intervalo_n: 1,
  cliente_id: "cliente",
  sistema_id: null,
  equipamento_id: "bomba",
  questionario_id: "questionario",
  tipo_tarefa_id: "tipo",
};
const ocorrencia: OcorrenciaPreventiva = {
  id: "ocorrencia",
  plano_id: plano.id,
  vencimento: "2027-11-26",
  visita_em: null,
  envio_estado: "prevista",
  auvo_task_id: null,
  tecnico_funcionario_id: null,
  erro_envio: null,
  resultado_estado: "pendente",
  resultado_atualizado_em: null,
};

it("preserva a data civil de vencimento e evita uma hora fictícia sem visita", () => {
  const selecionar = vi.fn();
  const itens = [
    {
      id: ocorrencia.id,
      nomePlano: plano.nome,
      vencimento: ocorrencia.vencimento,
      visitaEm: null,
      estado: "prevista",
      resultado: "pendente",
    },
  ] as const;
  const { rerender } = render(
    <PreventivasTimelineView ocorrencias={itens} onSelecionar={selecionar} />,
  );
  expect(screen.getByText(/Vencimento 26\/11\/2027/)).toBeVisible();
  expect(screen.queryByText(/00:00/)).not.toBeInTheDocument();
  rerender(<PreventivasListaView ocorrencias={itens} onSelecionar={selecionar} />);
  expect(screen.getByText("Vencimento 26/11/2027")).toBeVisible();
  expect(screen.queryByText(/00:00/)).not.toBeInTheDocument();
  rerender(
    <PreventivaDetalheDrawer
      plano={plano}
      ocorrencia={ocorrencia}
      ocorrenciasDoPlano={[ocorrencia]}
      temEscrita={false}
      onClose={vi.fn()}
      onConfirmarVisita={vi.fn()}
    />,
  );
  expect(screen.getByText(/Vencimento 26\/11\/2027/)).toBeVisible();
  expect(screen.getByText("26/11/2027", { selector: "dd" })).toBeVisible();
});
