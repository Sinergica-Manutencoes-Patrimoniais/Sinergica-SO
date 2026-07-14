import { describe, expect, it, vi } from "vitest";
import {
  aplicarTemplate,
  criarInspecao,
  criarItemInspecao,
  criarLaudoSpda,
  criarTemplate,
  criarTipoInspecao,
  editarInspecao,
  editarItemInspecao,
  editarTipoInspecao,
  excluirItemInspecao,
} from "./qualidade";
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
      codigo: null,
      tipoInspecaoId: input.tipoInspecaoId ?? null,
      tipoInspecaoNome: null,
      edificacao: input.edificacao ?? null,
      endereco: input.endereco ?? null,
      horaInicio: input.horaInicio ?? null,
      horaFim: input.horaFim ?? null,
      inspetor: input.inspetor ?? null,
      responsavelNoLocal: input.responsavelNoLocal ?? null,
      escopo: input.escopo ?? null,
      normaTecnica: input.normaTecnica ?? null,
      art: input.art ?? null,
      condicoes: input.condicoes ?? null,
      anexos: [],
    })),
    editarInspecao: vi.fn(async (input) => ({
      id: input.id,
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
      codigo: null,
      tipoInspecaoId: input.tipoInspecaoId ?? null,
      tipoInspecaoNome: null,
      edificacao: input.edificacao ?? null,
      endereco: input.endereco ?? null,
      horaInicio: input.horaInicio ?? null,
      horaFim: input.horaFim ?? null,
      inspetor: input.inspetor ?? null,
      responsavelNoLocal: input.responsavelNoLocal ?? null,
      escopo: input.escopo ?? null,
      normaTecnica: input.normaTecnica ?? null,
      art: input.art ?? null,
      condicoes: input.condicoes ?? null,
      anexos: [],
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
      categoria: input.categoria ?? null,
      elemento: input.elemento ?? null,
      identificacao: input.identificacao ?? null,
      grauRisco: input.grauRisco ?? null,
      estadoConservacao: input.estadoConservacao ?? null,
      anomalia: input.anomalia ?? null,
      medicoes: input.medicoes ?? null,
      midias: [],
      responsavelAcao: input.responsavelAcao ?? null,
      observacoes: input.observacoes ?? null,
    })),
    editarItemInspecao: vi.fn(async (input) => ({
      id: input.id,
      inspecaoId: input.inspecaoId,
      sistema: input.sistema,
      localizacao: input.localizacao,
      descricao: input.descricao,
      resultado: input.resultado,
      severidade: input.severidade,
      recomendacao: input.recomendacao,
      prazoRecomendado: input.prazoRecomendado,
      fotoUrl: input.fotoUrl,
      categoria: input.categoria ?? null,
      elemento: input.elemento ?? null,
      identificacao: input.identificacao ?? null,
      grauRisco: input.grauRisco ?? null,
      estadoConservacao: input.estadoConservacao ?? null,
      anomalia: input.anomalia ?? null,
      medicoes: input.medicoes ?? null,
      midias: [],
      responsavelAcao: input.responsavelAcao ?? null,
      observacoes: input.observacoes ?? null,
    })),
    excluirItemInspecao: vi.fn(async () => undefined),
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
    listarTiposInspecao: vi.fn(async () => []),
    criarTipoInspecao: vi.fn(async (input) => ({
      id: "tipo-1",
      nome: input.nome,
      normaTecnica: input.normaTecnica,
      descricao: input.descricao,
      ativo: true,
    })),
    editarTipoInspecao: vi.fn(async (input) => ({
      id: input.id,
      nome: input.nome,
      normaTecnica: input.normaTecnica,
      descricao: input.descricao,
      ativo: true,
    })),
    listarTemplates: vi.fn(async () => []),
    criarTemplate: vi.fn(async (input) => ({
      id: "template-1",
      tipoInspecaoId: input.tipoInspecaoId,
      nome: input.nome,
      ativo: true,
      itens: input.itens.map((item: (typeof input.itens)[number], index: number) => ({
        id: `item-${index}`,
        ordem: index,
        ...item,
      })),
    })),
    aplicarTemplate: vi.fn(async () => []),
    uploadMidiaItem: vi.fn(),
    removerMidiaItem: vi.fn(),
    urlAssinadaMidia: vi.fn(),
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

  it("edita cabeçalho de inspeção existente", async () => {
    const gateway = gatewayFake();
    await editarInspecao(gateway, {
      id: "ins-1",
      clientId: "cliente-1",
      titulo: "  Inspeção revisada  ",
      dataInspecao: "2026-07-04",
      responsavelTecnico: null,
      observacoesGerais: null,
      createdBy: "user-1",
      updatedBy: "user-1",
    });
    expect(gateway.editarInspecao).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ins-1", titulo: "Inspeção revisada" }),
    );
  });

  it("bloqueia editar inspeção sem id", async () => {
    await expect(
      editarInspecao(gatewayFake(), {
        id: "",
        clientId: "cliente-1",
        titulo: "Inspeção",
        dataInspecao: "2026-07-04",
        responsavelTecnico: null,
        observacoesGerais: null,
        createdBy: "user-1",
        updatedBy: "user-1",
      }),
    ).rejects.toThrow("Inspeção é obrigatória.");
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
    ).rejects.toThrow("Descrição do item é obrigatória.");
  });

  it("edita item existente", async () => {
    const gateway = gatewayFake();
    await editarItemInspecao(gateway, {
      id: "item-1",
      inspecaoId: "ins-1",
      clientId: "cliente-1",
      sistema: "spda",
      localizacao: null,
      descricao: "Atualizado",
      resultado: "conforme",
      severidade: "baixa",
      recomendacao: null,
      prazoRecomendado: null,
      fotoUrl: null,
      createdBy: "user-1",
      updatedBy: "user-1",
    });
    expect(gateway.editarItemInspecao).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-1", descricao: "Atualizado" }),
    );
  });

  it("bloqueia excluir item sem id", async () => {
    await expect(excluirItemInspecao(gatewayFake(), "")).rejects.toThrow("Item é obrigatório.");
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

  it("cria e edita tipo de inspeção", async () => {
    const gateway = gatewayFake();
    await criarTipoInspecao(gateway, {
      nome: "  Elétrica  ",
      normaTecnica: null,
      descricao: null,
      createdBy: "user-1",
    });
    expect(gateway.criarTipoInspecao).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Elétrica" }),
    );

    await editarTipoInspecao(gateway, {
      id: "tipo-1",
      nome: "Elétrica revisada",
      normaTecnica: null,
      descricao: null,
      createdBy: "user-1",
      updatedBy: "user-1",
    });
    expect(gateway.editarTipoInspecao).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tipo-1", nome: "Elétrica revisada" }),
    );
  });

  it("cria template com pelo menos 1 item", async () => {
    const gateway = gatewayFake();
    await criarTemplate(gateway, {
      tipoInspecaoId: "tipo-1",
      nome: "Padrão elétrica",
      itens: [
        { categoria: "Elétrica", sistema: "eletrico", elemento: "Quadro", obrigatorio: true },
      ],
      createdBy: "user-1",
    });
    expect(gateway.criarTemplate).toHaveBeenCalled();
  });

  it("bloqueia aplicar template sem inspecaoId/templateId", async () => {
    const gateway = gatewayFake();
    await expect(aplicarTemplate(gateway, "", "template-1", "user-1")).rejects.toThrow(
      "Inspeção é obrigatória.",
    );
    await expect(aplicarTemplate(gateway, "ins-1", "", "user-1")).rejects.toThrow(
      "Template é obrigatório.",
    );
  });
});
