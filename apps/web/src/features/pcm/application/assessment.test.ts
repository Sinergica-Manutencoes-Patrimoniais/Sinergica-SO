import { describe, expect, it, vi } from "vitest";
import type { Chamado } from "../domain/chamados";
import {
  classificarItensParaBacklog,
  confirmarGerarBacklog,
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
  fotoUrls: [],
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
  gravidade: null,
  urgencia: null,
  tendencia: null,
  esforcoHoras: null,
  justificativaEsforco: null,
  citacaoNormativa: null,
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
    atualizarResultadoItem: vi.fn(async () => ITEM),
    atualizarGutEsforcoItem: vi.fn(async () => ITEM),
  };
}

function gatewayChamadosFake(): ChamadosGateway {
  const chamado: Chamado = {
    id: "cha-1",
    numero: "CH-0001",
    clienteId: "cli-1",
    titulo: "Hidrante funcional?: Não",
    descricao: null,
    local: null,
    origem: "inspecao",
    status: "aberto",
    solicitante: null,
    ordemServicoId: null,
    cancelamentoJustificativa: null,
    cancelamentoAnexoPath: null,
    createdAt: "2026-07-21T10:00:00Z",
    dataPlanejada: null,
    dataExecucao: null,
    replanejamentos: 0,
  };
  return {
    listar: vi.fn(),
    obter: vi.fn(),
    criar: vi.fn(async () => chamado),
    marcarStatusComOs: vi.fn(),
    cancelar: vi.fn(),
    uploadAnexoCancelamento: vi.fn(),
    listarHistoricoAtendimento: vi.fn(),
    definirDataPlanejada: vi.fn(),
    marcarExecucao: vi.fn(),
    listarAnotacoes: vi.fn(),
    adicionarAnotacao: vi.fn(),
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

  describe("classificarItensParaBacklog — E01-S143", () => {
    it("AC-4: chama a IA (mesmo endpoint do import) e pareia por índice", async () => {
      const gatewayQualidade = gatewayQualidadeFake();
      gatewayQualidade.processarRelatorioInspecao = vi.fn(async () => [
        {
          local: "Hall",
          relatoOriginal: "Cabos expostos",
          sistema: "incendio" as const,
          tituloBacklog: "Cabos expostos",
          descricaoTecnica: "Cabos expostos",
          citacaoNormativa: "NBR 17240:2010",
          prioridade: "alta",
          categoria: "corretiva",
          gravidade: 5,
          urgencia: 4,
          tendencia: 4,
          esforcoHoras: 4,
          justificativaEsforco: "Precisa eletricista",
        },
      ]);
      const resultado = await classificarItensParaBacklog(gatewayQualidade, [
        { id: "item-1", localizacao: "Hall", descricao: "Cabos expostos" },
      ]);
      expect(resultado.correlacionou).toBe(true);
      expect(resultado.itens).toEqual([
        {
          itemId: "item-1",
          gravidade: 5,
          urgencia: 4,
          tendencia: 4,
          esforcoHoras: 4,
          justificativaEsforco: "Precisa eletricista",
          citacaoNormativa: "NBR 17240:2010",
        },
      ]);
    });

    it("IA indisponível cai pro fallback 3/3/3, não lança", async () => {
      const gatewayQualidade = gatewayQualidadeFake();
      gatewayQualidade.processarRelatorioInspecao = vi.fn(async () => {
        throw new Error("OpenRouter não configurado");
      });
      const resultado = await classificarItensParaBacklog(gatewayQualidade, [
        { id: "item-1", localizacao: null, descricao: "Vazamento" },
      ]);
      expect(resultado.correlacionou).toBe(false);
      expect(resultado.itens[0]).toMatchObject({ itemId: "item-1", gravidade: 3, esforcoHoras: 0 });
    });

    it("lista vazia não chama a IA", async () => {
      const gatewayQualidade = gatewayQualidadeFake();
      const resultado = await classificarItensParaBacklog(gatewayQualidade, []);
      expect(resultado).toEqual({ itens: [], correlacionou: true });
      expect(gatewayQualidade.processarRelatorioInspecao).not.toHaveBeenCalled();
    });
  });

  describe("confirmarGerarBacklog — E01-S143", () => {
    it("AC-5: persiste GUT/esforço no item e deriva a OS com a gravidade/urgência/tendência reais", async () => {
      const gatewayQualidade = gatewayQualidadeFake();
      const gatewayOs = gatewayOsFake();
      const classificacao = {
        itemId: "item-1",
        gravidade: 5,
        urgencia: 5,
        tendencia: 4,
        esforcoHoras: 4,
        justificativaEsforco: "Precisa eletricista",
        citacaoNormativa: "NBR 17240:2010",
      };
      await confirmarGerarBacklog(gatewayQualidade, gatewayOs, [{ item: ITEM, classificacao }], {
        clientId: "cli-1",
        tipoTarefaId: "tipo-1",
        userId: "user-1",
      });
      expect(gatewayQualidade.atualizarGutEsforcoItem).toHaveBeenCalledWith(
        "item-1",
        classificacao,
      );
      expect(gatewayOs.criarOrdemServico).toHaveBeenCalledWith(
        expect.objectContaining({
          origemInspecaoItemId: "item-1",
          gravidade: 5,
          urgencia: 5,
          tendencia: 4,
          prioridade: "critica",
          observacao: expect.stringContaining("Esforço estimado: 4h"),
        }),
      );
      expect(gatewayQualidade.marcarItemDerivado).toHaveBeenCalledWith(
        "item-1",
        "backlog",
        "sinergica",
      );
    });
  });
});
