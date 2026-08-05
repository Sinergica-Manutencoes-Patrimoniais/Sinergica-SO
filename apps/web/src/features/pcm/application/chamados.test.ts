import { describe, expect, it, vi } from "vitest";
import type { Chamado } from "../domain/chamados";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import {
  adicionarAnotacaoChamado,
  cancelarChamado,
  criarChamado,
  gerarOsDoChamado,
  gerarOsDoChamadoNoStatus,
  listarAnotacoesChamado,
  listarChamados,
} from "./chamados";
import type { ChamadosGateway } from "./chamados-gateway";
import type { OrdemServicoGateway } from "./ordem-servico-gateway";

const CHAMADO_ABERTO: Chamado = {
  id: "cha-1",
  numero: "CH-0001",
  clienteId: "cli-1",
  titulo: "Vazamento no térreo",
  descricao: "Água acumulando perto da garagem",
  local: null,
  origem: "manual",
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

function gatewayChamadosFake(): ChamadosGateway {
  return {
    listar: vi.fn(async () => [CHAMADO_ABERTO]),
    obter: vi.fn(async () => CHAMADO_ABERTO),
    criar: vi.fn(async (input) => ({ ...CHAMADO_ABERTO, ...input })),
    marcarStatusComOs: vi.fn(async () => undefined),
    cancelar: vi.fn(async () => undefined),
    uploadAnexoCancelamento: vi.fn(async () => "cha-1/print.png"),
    listarHistoricoAtendimento: vi.fn(async () => []),
    definirDataPlanejada: vi.fn(async () => undefined),
    marcarExecucao: vi.fn(async () => undefined),
    listarAnotacoes: vi.fn(async () => []),
    adicionarAnotacao: vi.fn(async (chamadoId, texto) => ({
      id: "anot-1",
      chamadoId,
      texto,
      autorNome: "Ana",
      createdAt: "2026-07-29T10:00:00Z",
    })),
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

describe("chamados (use case)", () => {
  it("listarChamados repassa os filtros ao gateway", async () => {
    const gateway = gatewayChamadosFake();
    await listarChamados(gateway, { status: "aberto" });
    expect(gateway.listar).toHaveBeenCalledWith({ status: "aberto" });
  });

  it("criarChamado normaliza e persiste", async () => {
    const gateway = gatewayChamadosFake();
    await criarChamado(gateway, { clienteId: "cli-1", titulo: "  Vazamento  ", userId: "user-1" });
    expect(gateway.criar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Vazamento", userId: "user-1" }),
    );
  });

  it("E01-S119 AC-1: normaliza anotação antes de persistir", async () => {
    const gateway = gatewayChamadosFake();
    await adicionarAnotacaoChamado(gateway, "cha-1", "  Retorno agendado.  ", "user-1");
    expect(gateway.adicionarAnotacao).toHaveBeenCalledWith("cha-1", "Retorno agendado.", "user-1");
  });

  it("E01-S119 AC-4: rejeita anotação vazia sem round-trip", async () => {
    const gateway = gatewayChamadosFake();
    await expect(adicionarAnotacaoChamado(gateway, "cha-1", "   ", "user-1")).rejects.toThrow(
      /não pode ficar vazia/,
    );
    expect(gateway.adicionarAnotacao).not.toHaveBeenCalled();
  });

  it("E01-S119 AC-2: delega lista de anotações ao gateway", async () => {
    const gateway = gatewayChamadosFake();
    await listarAnotacoesChamado(gateway, "cha-1");
    expect(gateway.listarAnotacoes).toHaveBeenCalledWith("cha-1");
  });

  describe("gerarOsDoChamado", () => {
    it("AC-3: cria a OS com clientId/título/descrição do Chamado e vincula chamadoId", async () => {
      const gatewayChamados = gatewayChamadosFake();
      const gatewayOs = gatewayOsFake();
      await gerarOsDoChamado(
        gatewayChamados,
        gatewayOs,
        CHAMADO_ABERTO,
        {
          categoria: "corretiva",
          prioridade: "media",
          gravidade: 3,
          urgencia: 3,
          tendencia: 3,
          dorCliente: null,
          observacao: null,
          localDescricao: null,
          solicitante: null,
          origem: "manual",
          tecnicoId: null,
          tipoTarefaId: "tipo-1",
          dataPrevista: null,
        },
        "user-1",
        "convertido_os",
      );
      expect(gatewayOs.criarOrdemServico).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "cli-1",
          titulo: "Vazamento no térreo",
          descricao: "Água acumulando perto da garagem",
          chamadoId: "cha-1",
        }),
      );
      expect(gatewayChamados.marcarStatusComOs).toHaveBeenCalledWith(
        "cha-1",
        "convertido_os",
        "os-1",
        "user-1",
      );
    });

    it("AC-3: rejeita quando o Chamado não está aberto, sem criar OS", async () => {
      const gatewayChamados = gatewayChamadosFake();
      const gatewayOs = gatewayOsFake();
      await expect(
        gerarOsDoChamado(
          gatewayChamados,
          gatewayOs,
          { ...CHAMADO_ABERTO, status: "cancelado" },
          {
            categoria: "corretiva",
            prioridade: "media",
            gravidade: 3,
            urgencia: 3,
            tendencia: 3,
            dorCliente: null,
            observacao: null,
            localDescricao: null,
            solicitante: null,
            origem: "manual",
            tecnicoId: null,
            tipoTarefaId: "tipo-1",
            dataPrevista: null,
          },
          "user-1",
          "backlog",
        ),
      ).rejects.toThrow();
      expect(gatewayOs.criarOrdemServico).not.toHaveBeenCalled();
    });

    it("E01-S124 AC-1: após converter, move a OS para a coluna de destino", async () => {
      const gatewayChamados = gatewayChamadosFake();
      const gatewayOs = gatewayOsFake();
      const gatewayHub = {
        alterarStatus: vi.fn(async () => ({}) as OrdemServicoOperacional),
      };

      await gerarOsDoChamadoNoStatus(
        gatewayChamados,
        gatewayOs,
        gatewayHub,
        CHAMADO_ABERTO,
        {
          categoria: "corretiva",
          prioridade: "media",
          gravidade: 3,
          urgencia: 3,
          tendencia: 3,
          dorCliente: null,
          observacao: null,
          localDescricao: null,
          solicitante: null,
          origem: "manual",
          tecnicoId: null,
          tipoTarefaId: "tipo-1",
          dataPrevista: null,
        },
        "user-1",
        "corretiva",
      );

      expect(gatewayChamados.marcarStatusComOs).toHaveBeenCalledWith(
        "cha-1",
        "convertido_os",
        "os-1",
        "user-1",
      );
      expect(gatewayHub.alterarStatus).toHaveBeenCalledWith({
        id: "os-1",
        status: "corretiva",
        updatedBy: "user-1",
      });
    });
  });

  describe("cancelarChamado", () => {
    it("AC-4: faz upload do anexo e cancela com a justificativa", async () => {
      const gateway = gatewayChamadosFake();
      const arquivo = new File(["x"], "print.png", { type: "image/png" });
      await cancelarChamado(gateway, CHAMADO_ABERTO, "  Cliente desistiu  ", arquivo, "user-1");
      expect(gateway.uploadAnexoCancelamento).toHaveBeenCalledWith("cha-1", arquivo);
      expect(gateway.cancelar).toHaveBeenCalledWith(
        "cha-1",
        "Cliente desistiu",
        "cha-1/print.png",
        "user-1",
      );
    });

    it("AC-4: sem anexo, cancela com anexoPath null e não faz upload", async () => {
      const gateway = gatewayChamadosFake();
      await cancelarChamado(gateway, CHAMADO_ABERTO, "motivo", null, "user-1");
      expect(gateway.uploadAnexoCancelamento).not.toHaveBeenCalled();
      expect(gateway.cancelar).toHaveBeenCalledWith("cha-1", "motivo", null, "user-1");
    });

    it("AC-4: rejeita sem justificativa antes de qualquer upload/round-trip", async () => {
      const gateway = gatewayChamadosFake();
      await expect(cancelarChamado(gateway, CHAMADO_ABERTO, "  ", null, "user-1")).rejects.toThrow(
        /Justificativa/,
      );
      expect(gateway.cancelar).not.toHaveBeenCalled();
    });
  });
});
