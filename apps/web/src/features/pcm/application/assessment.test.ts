import { describe, expect, it, vi } from "vitest";
import type { Chamado } from "../domain/chamados";
import {
  criarAssessment,
  derivarItemParaChamado,
  derivarItemParaOsOuBacklog,
  importarQuestionario,
} from "./assessment";
import type { ChamadosGateway } from "./chamados-gateway";
import type { OrdemServicoGateway } from "./ordem-servico-gateway";
import type { InspecaoItem, InspecaoResumo, QualidadeGateway } from "./qualidade-gateway";

const INSPECAO: InspecaoResumo = {
  id: "insp-1",
  clientId: "cli-1",
  clienteNome: "Cliente Teste",
  titulo: "Assessment — inicio",
  dataInspecao: "2026-07-21",
  responsavelTecnico: null,
  status: "em_andamento",
  observacoesGerais: null,
  totalItens: 0,
  itensConformes: 0,
  itensNaoConformes: 0,
  itensAtencao: 0,
  codigo: null,
  tipoInspecaoId: null,
  tipoInspecaoNome: null,
  edificacao: null,
  endereco: null,
  horaInicio: null,
  horaFim: null,
  inspetor: null,
  responsavelNoLocal: null,
  escopo: null,
  normaTecnica: null,
  art: null,
  condicoes: null,
  anexos: [],
  eAssessment: true,
  motivoAssessment: "inicio",
};

const ITEM: InspecaoItem = {
  id: "item-1",
  inspecaoId: "insp-1",
  sistema: "geral",
  localizacao: null,
  descricao: "Hidrante funcional?: Não",
  resultado: "nao_avaliado",
  severidade: "media",
  recomendacao: null,
  prazoRecomendado: null,
  fotoUrl: null,
  categoria: null,
  elemento: null,
  identificacao: null,
  grauRisco: null,
  estadoConservacao: null,
  anomalia: null,
  medicoes: null,
  midias: [],
  responsavelAcao: null,
  observacoes: null,
  destino: null,
  destinoResponsavel: null,
  auvoQuestaoChave: "q1",
};

function gatewayQualidadeFake(): QualidadeGateway {
  return {
    listarClientes: vi.fn(),
    listarInspecoes: vi.fn(),
    criarInspecao: vi.fn(async (input) => ({ ...INSPECAO, ...input })),
    editarInspecao: vi.fn(),
    listarItensInspecao: vi.fn(async () => [ITEM]),
    criarItemInspecao: vi.fn(),
    editarItemInspecao: vi.fn(),
    excluirItemInspecao: vi.fn(),
    processarRelatorioInspecao: vi.fn(),
    criarInspecaoImportada: vi.fn(),
    listarLaudosSpda: vi.fn(),
    criarLaudoSpda: vi.fn(),
    listarPontosSpda: vi.fn(),
    criarPontoSpda: vi.fn(),
    listarTiposInspecao: vi.fn(),
    criarTipoInspecao: vi.fn(),
    editarTipoInspecao: vi.fn(),
    listarTemplates: vi.fn(),
    criarTemplate: vi.fn(),
    aplicarTemplate: vi.fn(),
    uploadMidiaItem: vi.fn(),
    removerMidiaItem: vi.fn(),
    urlAssinadaMidia: vi.fn(),
    importarQuestionarioAuvo: vi.fn(async () => [ITEM]),
    marcarItemDerivado: vi.fn(async () => undefined),
    obterAssessmentVigente: vi.fn(async () => INSPECAO),
  };
}

function gatewayChamadosFake(): ChamadosGateway {
  const chamado: Chamado = {
    id: "cha-1",
    numero: "CH-0001",
    clienteId: "cli-1",
    titulo: "Hidrante funcional?: Não",
    descricao: null,
    origem: "inspecao",
    status: "aberto",
    solicitante: null,
    ordemServicoId: null,
    cancelamentoJustificativa: null,
    cancelamentoAnexoPath: null,
    createdAt: "2026-07-21T10:00:00Z",
  };
  return {
    listar: vi.fn(),
    obter: vi.fn(),
    criar: vi.fn(async () => chamado),
    marcarStatusComOs: vi.fn(),
    cancelar: vi.fn(),
    uploadAnexoCancelamento: vi.fn(),
    listarHistoricoAtendimento: vi.fn(),
  };
}

function gatewayOsFake(): OrdemServicoGateway {
  return {
    carregarDadosAbertura: vi.fn(),
    criarOrdemServico: vi.fn(async () => ({ id: "os-1", numero: "OS-0001" })),
    editarOrdemServico: vi.fn(),
    iaTituloAtiva: vi.fn(),
    gerarTituloOs: vi.fn(),
    obterPesosGutd: vi.fn(),
  };
}

describe("assessment (use case)", () => {
  it("AC-1: criarAssessment monta CriarInspecaoInput com eAssessment=true", async () => {
    const gateway = gatewayQualidadeFake();
    await criarAssessment(gateway, {
      clientId: "cli-1",
      motivo: "inicio",
      dataInspecao: "2026-07-21",
      createdBy: "user-1",
    });
    expect(gateway.criarInspecao).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cli-1", eAssessment: true, motivoAssessment: "inicio" }),
    );
  });

  it("AC-2: importarQuestionario rejeita auvoTaskId inválido antes do round-trip", async () => {
    const gateway = gatewayQualidadeFake();
    await expect(importarQuestionario(gateway, "insp-1", "cli-1", 0, "user-1")).rejects.toThrow(
      /Auvo/,
    );
    expect(gateway.importarQuestionarioAuvo).not.toHaveBeenCalled();
  });

  it("AC-2: importarQuestionario repassa ao gateway com id válido", async () => {
    const gateway = gatewayQualidadeFake();
    await importarQuestionario(gateway, "insp-1", "cli-1", 123, "user-1");
    expect(gateway.importarQuestionarioAuvo).toHaveBeenCalledWith("insp-1", "cli-1", 123, "user-1");
  });

  describe("derivarItemParaChamado", () => {
    it("AC-3: cria o Chamado com origemInspecaoItemId e marca o item derivado", async () => {
      const gatewayQualidade = gatewayQualidadeFake();
      const gatewayChamados = gatewayChamadosFake();
      await derivarItemParaChamado(
        gatewayQualidade,
        gatewayChamados,
        ITEM,
        "cli-1",
        "sinergica",
        "user-1",
      );
      expect(gatewayChamados.criar).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteId: "cli-1",
          origem: "inspecao",
          origemInspecaoItemId: "item-1",
        }),
      );
      expect(gatewayQualidade.marcarItemDerivado).toHaveBeenCalledWith(
        "item-1",
        "chamado",
        "sinergica",
      );
    });

    it("caso de borda: item já derivado não deriva de novo, sem round-trip", async () => {
      const gatewayQualidade = gatewayQualidadeFake();
      const gatewayChamados = gatewayChamadosFake();
      await expect(
        derivarItemParaChamado(
          gatewayQualidade,
          gatewayChamados,
          { ...ITEM, destino: "chamado" },
          "cli-1",
          "sinergica",
          "user-1",
        ),
      ).rejects.toThrow(/já foi derivado/);
      expect(gatewayChamados.criar).not.toHaveBeenCalled();
    });
  });

  describe("derivarItemParaOsOuBacklog", () => {
    it("AC-3: abre a OS com origemInspecaoItemId e marca o item com o destino escolhido", async () => {
      const gatewayQualidade = gatewayQualidadeFake();
      const gatewayOs = gatewayOsFake();
      await derivarItemParaOsOuBacklog(
        gatewayQualidade,
        gatewayOs,
        ITEM,
        {
          clientId: "cli-1",
          titulo: "Hidrante",
          descricao: null,
          categoria: "corretiva",
          prioridade: "media",
          gravidade: 3,
          urgencia: 3,
          tendencia: 3,
          dorCliente: null,
          observacao: null,
          localDescricao: null,
          solicitante: null,
          origem: "vistoria",
          tecnicoId: null,
          tipoTarefaId: "tipo-1",
          dataPrevista: null,
        },
        "backlog",
        "terceiro",
        "user-1",
      );
      expect(gatewayOs.criarOrdemServico).toHaveBeenCalledWith(
        expect.objectContaining({ origemInspecaoItemId: "item-1" }),
      );
      expect(gatewayQualidade.marcarItemDerivado).toHaveBeenCalledWith(
        "item-1",
        "backlog",
        "terceiro",
      );
    });
  });
});
