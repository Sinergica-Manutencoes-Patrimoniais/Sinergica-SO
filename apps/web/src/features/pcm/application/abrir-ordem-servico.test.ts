import { describe, expect, it, vi } from "vitest";
import { PESOS_GUTD_PADRAO } from "../domain/priorizacao-backlog";
import { abrirOrdemServico, confirmarChamadoBacklog } from "./abrir-ordem-servico";
import type { CriarOrdemServicoInput, OrdemServicoGateway } from "./ordem-servico-gateway";

const input: CriarOrdemServicoInput = {
  clientId: "c1",
  titulo: " Vazamento ",
  descricao: null,
  categoria: "corretiva",
  prioridade: "alta",
  gravidade: 4,
  urgencia: 4,
  tendencia: 4,
  dorCliente: null,
  observacao: null,
  localDescricao: "Garagem",
  solicitante: "João",
  origem: "manual",
  tecnicoId: null,
  tipoTarefaId: "tipo1",
  dataPrevista: null,
  createdBy: "u1",
};

function gatewayMock(): OrdemServicoGateway {
  return {
    carregarDadosAbertura: vi.fn(async () => ({ clientes: [], tecnicos: [], tiposTarefa: [] })),
    listarEquipamentosDoCliente: vi.fn(async () => []),
    criarOrdemServico: vi.fn(async () => ({ id: "os1", numero: "OS-0001" })),
    confirmarChamado: vi.fn(async () => ({ numero: "CH-0001" })),
    editarOrdemServico: vi.fn(async () => undefined),
    iaTituloAtiva: vi.fn(async () => false),
    gerarTituloOs: vi.fn(async () => ""),
    obterPesosGutd: vi.fn(async () => PESOS_GUTD_PADRAO),
  };
}

describe("abrirOrdemServico", () => {
  it("AC-4: normaliza título e delega criação ao gateway", async () => {
    const gateway = gatewayMock();
    await abrirOrdemServico(gateway, input);
    expect(gateway.criarOrdemServico).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Vazamento" }),
    );
  });

  it("AC-5: rejeita cliente vazio antes do gateway", async () => {
    await expect(abrirOrdemServico(gatewayMock(), { ...input, clientId: "" })).rejects.toThrow(
      /Cliente/,
    );
  });

  it("AC-5: rejeita título vazio antes do gateway", async () => {
    await expect(abrirOrdemServico(gatewayMock(), { ...input, titulo: "   " })).rejects.toThrow(
      /Título/,
    );
  });

  it("AC-2 (E01-S39): rejeita tipo de tarefa vazio quando já tem técnico ou data (OS agendada)", async () => {
    await expect(
      abrirOrdemServico(gatewayMock(), { ...input, tipoTarefaId: "", tecnicoId: "t1" }),
    ).rejects.toThrow(/Tipo de tarefa/);
    await expect(
      abrirOrdemServico(gatewayMock(), { ...input, tipoTarefaId: "", dataPrevista: "2026-08-20" }),
    ).rejects.toThrow(/Tipo de tarefa/);
  });

  it("E01-S83: aceita tipo de tarefa vazio/null quando não tem técnico nem data (item de backlog puro)", async () => {
    const gateway = gatewayMock();
    await expect(
      abrirOrdemServico(gateway, {
        ...input,
        tipoTarefaId: null,
        tecnicoId: null,
        dataPrevista: null,
      }),
    ).resolves.toEqual({ id: "os1", numero: "OS-0001" });
  });

  it("E01-S151: cria com semChamado repassa a flag pro gateway", async () => {
    const gateway = gatewayMock();
    await abrirOrdemServico(gateway, { ...input, tipoTarefaId: null, semChamado: true });
    expect(gateway.criarOrdemServico).toHaveBeenCalledWith(
      expect.objectContaining({ semChamado: true }),
    );
  });
});

describe("confirmarChamadoBacklog", () => {
  it("E01-S151: delega pro gateway e devolve o número do Chamado criado", async () => {
    const gateway = gatewayMock();
    await expect(
      confirmarChamadoBacklog(gateway, { ordemId: "os1", userId: "u1" }),
    ).resolves.toEqual({ numero: "CH-0001" });
    expect(gateway.confirmarChamado).toHaveBeenCalledWith({ ordemId: "os1", userId: "u1" });
  });

  it("E01-S151: rejeita sem ordemId antes do gateway", async () => {
    await expect(
      confirmarChamadoBacklog(gatewayMock(), { ordemId: "", userId: "u1" }),
    ).rejects.toThrow(/backlog/);
  });
});
