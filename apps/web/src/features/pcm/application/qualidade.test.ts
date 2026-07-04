import { describe, expect, it, vi } from "vitest";
import { criarInspecao, criarItemInspecao } from "./qualidade";
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
    listarLaudosSpda: vi.fn(),
    criarLaudoSpda: vi.fn(),
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
});
