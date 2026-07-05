import { describe, expect, it, vi } from "vitest";
import { criarInspecao, criarItemInspecao, criarLaudoSpda } from "./qualidade";
import type { QualidadeGateway } from "./qualidade-gateway";

function gatewayFake(): QualidadeGateway {
  return {
    listarClientes: vi.fn(),
    listarInspecoes: vi.fn(),
    criarInspecao: vi.fn(async (input) => ({
      id: "ins-1",
      clientId: input.clientId,
      clienteNome: "Cliente",
      titulo: input.titulo,
      dataInspecao: input.dataInspecao,
      responsavelTecnico: input.responsavelTecnico,
      status: "em_andamento" as const,
      observacoesGerais: input.observacoesGerais,
      totalItens: 0,
      itensConformes: 0,
      itensNaoConformes: 0,
      itensAtencao: 0,
    })),
    listarItensInspecao: vi.fn(),
    criarItemInspecao: vi.fn(async (input) => ({
      id: "item-1",
      inspecaoId: input.inspecaoId,
      sistema: input.sistema,
      localizacao: input.localizacao,
      descricao: input.descricao,
      resultado: input.resultado,
      severidade: input.severidade,
      recomendacao: input.recomendacao,
      prazoRecomendado: input.prazoRecomendado,
      fotoUrl: input.fotoUrl,
    })),
    processarRelatorioInspecao: vi.fn(async () => []),
    criarInspecaoImportada: vi.fn(async (input) => ({
      id: "ins-importada",
      clientId: input.clientId,
      clienteNome: "Cliente",
      titulo: input.titulo,
      dataInspecao: input.dataInspecao,
      responsavelTecnico: input.responsavelTecnico,
      status: "concluida" as const,
      observacoesGerais: input.observacoesGerais,
      totalItens: input.itens.length,
      itensConformes: 0,
      itensNaoConformes: input.itens.length,
      itensAtencao: 0,
    })),
    listarLaudosSpda: vi.fn(),
    criarLaudoSpda: vi.fn(async (input) => ({
      id: "laudo-1",
      clientId: input.clientId,
      clienteNome: "Cliente",
      numero: "SPDA-0001",
      status: "em_andamento" as const,
      dataVistoria: input.dataVistoria,
      arteNumero: input.arteNumero,
      responsavelTecnico: input.responsavelTecnico,
      notasGerais: input.notasGerais,
      conclusao: null,
      nivelProtecao: input.nivelProtecao,
      necessitaSpda: null,
      riscoTotal: null,
    })),
    listarPontosSpda: vi.fn(),
    criarPontoSpda: vi.fn(),
  };
}

describe("qualidade", () => {
  it("normaliza campos de inspeção antes de persistir", async () => {
    const gateway = gatewayFake();

    await criarInspecao(gateway, {
      clientId: "cliente-1",
      titulo: "  Inspeção mensal  ",
      dataInspecao: "2026-07-04",
      responsavelTecnico: "  João  ",
      observacoesGerais: "  Obs  ",
      createdBy: "user-1",
    });

    expect(gateway.criarInspecao).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: "Inspeção mensal",
        responsavelTecnico: "João",
        observacoesGerais: "Obs",
      }),
    );
  });

  it("bloqueia inspeção sem cliente", async () => {
    const gateway = gatewayFake();

    await expect(
      criarInspecao(gateway, {
        clientId: "",
        titulo: "Inspeção mensal",
        dataInspecao: "2026-07-04",
        responsavelTecnico: null,
        observacoesGerais: null,
        createdBy: "user-1",
      }),
    ).rejects.toThrow("Cliente é obrigatório.");
    expect(gateway.criarInspecao).not.toHaveBeenCalled();
  });

  it("bloqueia item sem descrição", async () => {
    await expect(
      criarItemInspecao(gatewayFake(), {
        inspecaoId: "ins-1",
        clientId: "cliente-1",
        sistema: "spda",
        localizacao: null,
        descricao: " ",
        resultado: "nao_avaliado",
        severidade: "media",
        recomendacao: null,
        prazoRecomendado: null,
        fotoUrl: null,
        createdBy: "user-1",
      }),
    ).rejects.toThrow("Descrição do item é obrigatório.");
  });

  it("bloqueia laudo SPDA sem cliente", async () => {
    const gateway = gatewayFake();

    await expect(
      criarLaudoSpda(gateway, {
        clientId: "",
        dataVistoria: "2026-07-04",
        arteNumero: null,
        responsavelTecnico: null,
        notasGerais: null,
        nivelProtecao: "III",
        createdBy: "user-1",
      }),
    ).rejects.toThrow("Cliente é obrigatório.");
    expect(gateway.criarLaudoSpda).not.toHaveBeenCalled();
  });
});
