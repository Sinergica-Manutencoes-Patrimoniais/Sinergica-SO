import { describe, expect, it } from "vitest";
import { prepararAberturaOrdemServico } from "./abrir-ordem-servico";
import type { CriarOrdemServicoInput } from "./ordem-servico-gateway";

const input: CriarOrdemServicoInput = {
  clientId: "cliente", titulo: "  Serviço  ", descricao: "descrição", categoria: "corretiva",
  prioridade: "alta", gravidade: 4, urgencia: 3, tendencia: 2, dorCliente: 1,
  observacao: "observação", localDescricao: "local", solicitante: "solicitante", origem: "manual",
  tecnicoId: "tecnico", tipoTarefaId: "tipo", dataPrevista: "2026-10-30", createdBy: "ator",
  chamadoId: "chamado", origemInspecaoItemId: "inspecao", equipamentoId: "equipamento", fotoUrls: ["foto"],
};

describe("preparar abertura de OS", () => {
  it("preserva o payload integral da abertura e só normaliza campos já normalizados pelo fluxo", () => {
    const resultado = prepararAberturaOrdemServico(input);
    expect(resultado).toEqual({ ...input, titulo: "Serviço", tipoOs: "C2", pmocScheduleId: null });
    expect(input.titulo).toBe("  Serviço  ");
  });

  it("mantém validação de tipo de tarefa para agendamento", () => {
    expect(() => prepararAberturaOrdemServico({ ...input, tipoTarefaId: null })).toThrow("Tipo de tarefa é obrigatório");
  });
});
