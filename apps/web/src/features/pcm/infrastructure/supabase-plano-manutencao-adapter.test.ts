import { beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabasePlanoManutencaoAdapter } from "./supabase-plano-manutencao-adapter";

const requestId = "16500000-0000-4000-8000-000000000101";
const planoId = "16500000-0000-4000-8000-000000000011";
const rotinaId = "16500000-0000-4000-8000-000000000081";
const clienteId = "16500000-0000-4000-8000-00000000000a";
const edicao = {
  requestId,
  expectedRevision: 2,
  planoId,
  rotinaId,
  nome: "Mensal",
  alvoTipo: "sistema" as const,
  alvoId: "16500000-0000-4000-8000-000000000051",
  modo: "calendario" as const,
  intervalo: 1,
  unidade: "meses" as const,
  dataBase: "2026-11-01",
  tempoMinutos: 45,
  toleranciaAntes: 2,
  toleranciaDepois: 3,
  instrucao: "Inspecionar",
  questionarioId: null,
  tipoTempo: "total" as const,
};

describe("adapter do Plano de Manutenção", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.schema.mockReturnValue({ rpc: api.rpc });
  });
  it("envia retirada de rascunho com revisão e motivo", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: planoId,
        revision: 3,
        state: "rascunho",
        created: false,
        linkedIds: { clienteId },
        warnings: [],
        requestId,
      },
      error: null,
    });
    await supabasePlanoManutencaoAdapter.retirarRotina({
      requestId,
      expectedRevision: 2,
      planoId,
      rotinaId,
      motivo: "Escopo revisado",
    });
    expect(api.rpc).toHaveBeenCalledWith("sso_retirar_rotina_rascunho", {
      p_request_id: requestId,
      p_expected_revision: 2,
      p_plano_id: planoId,
      p_rotina_id: rotinaId,
      p_motivo: "Escopo revisado",
    });
  });
  it("consulta questionário histórico sem transformar perguntas", async () => {
    const versaoId = "16500000-0000-4000-8000-000000000091";
    const questionario = {
      id: requestId,
      nome: "Inspeção",
      cabecalho: null,
      rodape: null,
      perguntas: [{ tipo: "foto", texto: "Conferir" }],
    };
    api.rpc.mockResolvedValue({ data: { rotinaId, versaoId, questionario }, error: null });
    expect(
      await supabasePlanoManutencaoAdapter.consultarQuestionarioAprovado(
        planoId,
        versaoId,
        rotinaId,
      ),
    ).toEqual({ rotinaId, versaoId, questionario });
    expect(api.rpc).toHaveBeenCalledWith("sso_questionario_rotina_aprovada", {
      p_plano_id: planoId,
      p_versao_id: versaoId,
      p_rotina_id: rotinaId,
    });
  });
  it("recusa questionário cuja versão não corresponde à consultada", async () => {
    const versaoId = "16500000-0000-4000-8000-000000000091";
    api.rpc.mockResolvedValue({
      data: { rotinaId, versaoId: requestId, questionario: null },
      error: null,
    });
    await expect(
      supabasePlanoManutencaoAdapter.consultarQuestionarioAprovado(planoId, versaoId, rotinaId),
    ).rejects.toThrow();
  });
  it("consulta ciclos com identidade e converte tolerâncias do servidor", async () => {
    const versaoId = "16500000-0000-4000-8000-000000000091";
    api.rpc.mockResolvedValue({
      data: [{ ciclo: 1, vencimento: "2026-12-01", tolerancia_antes: 2, tolerancia_depois: 3 }],
      error: null,
    });
    expect(
      await supabasePlanoManutencaoAdapter.preverCiclos(
        planoId,
        versaoId,
        rotinaId,
        "2026-11-01",
        "2026-12-31",
      ),
    ).toEqual([{ ciclo: 1, vencimento: "2026-12-01", toleranciaAntes: 2, toleranciaDepois: 3 }]);
    expect(api.rpc).toHaveBeenCalledWith("sso_prever_ciclos_rotina", {
      p_plano_id: planoId,
      p_versao_id: versaoId,
      p_rotina_id: rotinaId,
      p_inicio: "2026-11-01",
      p_fim: "2026-12-31",
    });
  });
  it("consulta comparação preservando aviso de impactos pendentes", async () => {
    api.rpc.mockResolvedValue({
      data: [
        {
          rotina_logica_id: rotinaId,
          rotina_anterior_id: null,
          rotina_rascunho_id: requestId,
          nome_anterior: null,
          nome_rascunho: "Nova",
          classificacao: "adicionada",
          revisao: 5,
          impactos_operacionais_pendentes: true,
        },
      ],
      error: null,
    });
    expect(await supabasePlanoManutencaoAdapter.preverRevisao(planoId, 20, null)).toEqual([
      {
        rotinaLogicaId: rotinaId,
        rotinaAnteriorId: null,
        rotinaRascunhoId: requestId,
        nomeAnterior: null,
        nomeRascunho: "Nova",
        classificacao: "adicionada",
        revisao: 5,
        impactosOperacionaisPendentes: true,
      },
    ]);
    expect(api.rpc).toHaveBeenCalledWith("sso_previa_revisao_plano", {
      p_plano_id: planoId,
      p_limite: 20,
      p_apos: null,
    });
  });
  it("consulta envelope revisionado vazio e rejeita revisão diferente", async () => {
    const versaoAnteriorId = "16500000-0000-4000-8000-000000000090";
    const versaoRascunhoId = "16500000-0000-4000-8000-000000000091";
    const resposta = {
      revision: 5,
      versaoAnteriorId,
      versaoRascunhoId,
      items: [],
      nextCursor: null,
      impactosOperacionaisPendentes: true,
    };
    api.rpc.mockResolvedValue({ data: resposta, error: null });
    expect(
      await supabasePlanoManutencaoAdapter.preverRevisaoRevisionada(planoId, 5, 20, null),
    ).toEqual(resposta);
    expect(api.rpc).toHaveBeenCalledWith("sso_previa_revisao_revisionada", {
      p_plano_id: planoId,
      p_revisao: 5,
      p_limite: 20,
      p_apos: null,
    });
    await expect(
      supabasePlanoManutencaoAdapter.preverRevisaoRevisionada(planoId, 6, 20, null),
    ).rejects.toThrow();
  });
  it("valida projeção de Rotina revisionada e rejeita campos não previstos", async () => {
    const campos = {
      id: rotinaId,
      nome: "Inspeção",
      alvo_tipo: "sistema",
      sistema_id: requestId,
      equipamento_id: null,
      grupo_id: null,
      modo: "calendario",
      intervalo_n: 1,
      intervalo_unidade: "meses",
      data_base: "2026-11-01",
      tempo_minutos: 30,
      tipo_tempo: "total",
      tolerancia_antes: 0,
      tolerancia_depois: 0,
      instrucao: "Inspecionar",
      questionario_id: null,
    };
    const item = {
      rotinaLogicaId: rotinaId,
      classificacao: "inalterada",
      questionarioConteudoPendente: false,
      anterior: campos,
      rascunho: campos,
    };
    const envelope = {
      revision: 5,
      versaoAnteriorId: "16500000-0000-4000-8000-000000000090",
      versaoRascunhoId: "16500000-0000-4000-8000-000000000091",
      nextCursor: null,
      impactosOperacionaisPendentes: true,
      items: [item],
    };
    api.rpc
      .mockResolvedValueOnce({ data: envelope, error: null })
      .mockResolvedValueOnce({
        data: { ...envelope, items: [{ ...item, anterior: { ...campos, auvo_payload: {} } }] },
        error: null,
      });
    expect(
      (await supabasePlanoManutencaoAdapter.preverRevisaoRevisionada(planoId, 5, 20, null)).items[0]
        ?.anterior?.nome,
    ).toBe("Inspeção");
    await expect(
      supabasePlanoManutencaoAdapter.preverRevisaoRevisionada(planoId, 5, 20, null),
    ).rejects.toThrow();
  });
  it("recusa Rotinas repetidas e cursor divergente na prévia revisionada", async () => {
    const item = { rotinaLogicaId: rotinaId, classificacao: "retirada", questionarioConteudoPendente: false, anterior: null, rascunho: null };
    const envelope = { revision: 5, versaoAnteriorId: "16500000-0000-4000-8000-000000000090", versaoRascunhoId: "16500000-0000-4000-8000-000000000091", impactosOperacionaisPendentes: true };
    api.rpc.mockResolvedValueOnce({ data: { ...envelope, items: [item, item], nextCursor: null }, error: null })
      .mockResolvedValueOnce({ data: { ...envelope, items: [item], nextCursor: requestId }, error: null });
    await expect(supabasePlanoManutencaoAdapter.preverRevisaoRevisionada(planoId, 5, 20, null)).rejects.toThrow("Paginação da prévia divergente.");
    await expect(supabasePlanoManutencaoAdapter.preverRevisaoRevisionada(planoId, 5, 20, null)).rejects.toThrow("Cursor da prévia divergente.");
  });
  it("envia início de revisão com identidade estável da nova versão", async () => {
    const novaVersaoId = "16500000-0000-4000-8000-000000000091";
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: planoId,
        revision: 5,
        state: "rascunho",
        created: true,
        linkedIds: { clienteId, versaoId: novaVersaoId },
        warnings: [],
        requestId,
      },
      error: null,
    });
    await supabasePlanoManutencaoAdapter.iniciarRevisao({
      requestId,
      expectedRevision: 4,
      planoId,
      novaVersaoId,
    });
    expect(api.rpc).toHaveBeenCalledWith("sso_iniciar_revisao_plano", {
      p_request_id: requestId,
      p_expected_revision: 4,
      p_plano_id: planoId,
      p_nova_versao_id: novaVersaoId,
    });
  });
  it("aprova sem perder avisos por Rotina retornados pelo servidor", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: planoId,
        revision: 4,
        state: "aprovado",
        created: false,
        linkedIds: { clienteId },
        warnings: [{ rotinaId, pendencias: ["tempo_a_validar"] }],
        requestId,
      },
      error: null,
    });
    const resultado = await supabasePlanoManutencaoAdapter.aprovarPlano({
      requestId,
      planoId,
      expectedRevision: 3,
      vigencia: "2026-11-01",
    });
    expect(resultado.warnings).toEqual([{ rotinaId, pendencias: ["tempo_a_validar"] }]);
    expect(api.rpc).toHaveBeenCalledWith("sso_aprovar_plano", {
      p_request_id: requestId,
      p_expected_revision: 3,
      p_plano_id: planoId,
      p_vigencia: "2026-11-01",
    });
  });
  it("submete a revisão com identidade e revisão do comando", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: planoId,
        revision: 4,
        state: "em_revisao",
        created: false,
        linkedIds: { clienteId },
        warnings: [],
        requestId,
      },
      error: null,
    });
    const resultado = await supabasePlanoManutencaoAdapter.transicionarRevisao({
      requestId,
      planoId,
      expectedRevision: 3,
      acao: "submeter",
    });
    expect(resultado.state).toBe("em_revisao");
    expect(api.rpc).toHaveBeenCalledWith("sso_transicionar_revisao_plano", {
      p_request_id: requestId,
      p_expected_revision: 3,
      p_plano_id: planoId,
      p_acao: "submeter",
    });
  });
  it("envia edição com tolerâncias e referência de tempo numa única transação", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: planoId,
        revision: 3,
        state: "rascunho",
        created: false,
        linkedIds: { clienteId, rotinaId },
        warnings: [],
        requestId,
      },
      error: null,
    });
    expect((await supabasePlanoManutencaoAdapter.editarRotina(edicao)).revision).toBe(3);
    expect(api.schema).toHaveBeenCalledWith("pcm");
    expect(api.rpc).toHaveBeenCalledWith(
      "sso_editar_rotina_rascunho_v2",
      expect.objectContaining({
        p_request_id: requestId,
        p_expected_revision: 2,
        p_plano_id: planoId,
        p_rotina_id: rotinaId,
        p_tolerancia_antes: 2,
        p_tolerancia_depois: 3,
        p_tipo_tempo: "total",
      }),
    );
  });
  it("cria Rotina completa com as mesmas opções da edição", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: planoId,
        revision: 3,
        state: "rascunho",
        created: true,
        linkedIds: { clienteId, rotinaId },
        warnings: [],
        requestId,
      },
      error: null,
    });
    await supabasePlanoManutencaoAdapter.adicionarRotinaCompleta(edicao);
    expect(api.rpc).toHaveBeenCalledWith(
      "sso_adicionar_rotina_rascunho_v2",
      expect.objectContaining({
        p_request_id: requestId,
        p_instrucao: "Inspecionar",
        p_tolerancia_antes: 2,
        p_tolerancia_depois: 3,
        p_tipo_tempo: "total",
      }),
    );
  });
  it("propaga falha e não interpreta resposta incompleta como sucesso", async () => {
    api.rpc
      .mockResolvedValueOnce({ data: null, error: new Error("negado") })
      .mockResolvedValueOnce({ data: { revision: 3 }, error: null });
    await expect(supabasePlanoManutencaoAdapter.editarRotina(edicao)).rejects.toThrow("negado");
    await expect(supabasePlanoManutencaoAdapter.editarRotina(edicao)).rejects.toThrow();
  });
  it("mapeia rascunho e nova Rotina aos comandos sem efeitos externos", async () => {
    api.rpc.mockResolvedValue({
      data: {
        aggregateId: planoId,
        revision: 1,
        state: "rascunho",
        created: true,
        linkedIds: { clienteId },
        warnings: [],
        requestId,
      },
      error: null,
    });
    await supabasePlanoManutencaoAdapter.salvarPlano({
      requestId,
      expectedRevision: 0,
      planoId,
      clienteId,
      nome: "Preventivo",
    });
    expect(api.rpc).toHaveBeenNthCalledWith(1, "sso_salvar_plano_rascunho", {
      p_request_id: requestId,
      p_expected_revision: 0,
      p_plano_id: planoId,
      p_cliente_id: clienteId,
      p_nome: "Preventivo",
    });
    const {
      toleranciaAntes: _a,
      toleranciaDepois: _d,
      instrucao: _i,
      questionarioId: _q,
      tipoTempo: _t,
      ...nova
    } = edicao;
    await supabasePlanoManutencaoAdapter.adicionarRotina(nova);
    expect(api.rpc).toHaveBeenNthCalledWith(2, "sso_adicionar_rotina_rascunho", {
      p_request_id: requestId,
      p_expected_revision: 2,
      p_plano_id: planoId,
      p_rotina_id: rotinaId,
      p_nome: "Mensal",
      p_alvo_tipo: "sistema",
      p_alvo_id: edicao.alvoId,
      p_modo: "calendario",
      p_intervalo: 1,
      p_unidade: "meses",
      p_data_base: "2026-11-01",
      p_tempo_minutos: 45,
    });
  });
  it("consulta apenas Planos do Cliente, com cursor e limite", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), gt: vi.fn(), order: vi.fn(), limit: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gt.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({
      data: [
        { id: planoId, cliente_id: clienteId, nome: "Preventivo", estado: "rascunho", revisao: 2 },
      ],
      error: null,
    });
    const from = vi.fn().mockReturnValue(query);
    api.schema.mockReturnValue({ from });
    expect(await supabasePlanoManutencaoAdapter.listarPlanos(clienteId, 20, planoId)).toEqual([
      { id: planoId, clienteId, nome: "Preventivo", estado: "rascunho", revisao: 2 },
    ]);
    expect(query.eq).toHaveBeenCalledWith("cliente_id", clienteId);
    expect(query.gt).toHaveBeenCalledWith("id", planoId);
    expect(query.limit).toHaveBeenCalledWith(20);
  });
  it("consulta Rotinas de uma versão sem misturar alvos", async () => {
    const versaoId = "16500000-0000-4000-8000-000000000091";
    api.rpc.mockResolvedValue({
      data: [
        {
          id: rotinaId,
          plano_id: planoId,
          versao_id: versaoId,
          nome: "Mensal",
          alvo_tipo: "sistema",
          sistema_id: edicao.alvoId,
          equipamento_id: null,
          grupo_id: null,
          modo: "calendario",
          intervalo_n: 1,
          intervalo_unidade: "meses",
          data_base: "2026-11-01",
          tempo_minutos: 45,
          tipo_tempo: "total",
          tolerancia_antes: 2,
          tolerancia_depois: 3,
          instrucao: "Inspecionar",
          questionario_id: null,
          alvo_nome: "Extintores",
          alvo_ativo: true,
          questionario_nome: null,
        },
      ],
      error: null,
    });
    const resultado = await supabasePlanoManutencaoAdapter.listarRotinas(
      planoId,
      versaoId,
      20,
      null,
    );
    expect(resultado[0]).toMatchObject({
      id: rotinaId,
      planoId,
      versaoId,
      alvoTipo: "sistema",
      alvoId: edicao.alvoId,
      alvoNome: "Extintores",
      tipoTempo: "total",
    });
    expect(api.rpc).toHaveBeenCalledWith("sso_listar_rotinas_plano", {
      p_plano_id: planoId,
      p_versao_id: versaoId,
      p_limite: 20,
      p_apos: null,
    });
  });
  it("lista versões somente do Plano solicitado", async () => {
    const versaoId = "16500000-0000-4000-8000-000000000091";
    const query = { select: vi.fn(), eq: vi.fn(), gt: vi.fn(), order: vi.fn(), limit: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gt.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({
      data: [
        {
          id: versaoId,
          plano_id: planoId,
          numero: 1,
          estado: "rascunho",
          vigencia_inicio: null,
          vigencia_fim: null,
        },
      ],
      error: null,
    });
    api.schema.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    expect(await supabasePlanoManutencaoAdapter.listarVersoes(planoId, 20, null)).toEqual([
      {
        id: versaoId,
        planoId,
        numero: 1,
        estado: "rascunho",
        vigenciaInicio: null,
        vigenciaFim: null,
      },
    ]);
    expect(query.eq).toHaveBeenCalledWith("plano_id", planoId);
  });
  it("consulta alvos por Plano, tipo e cursor", async () => {
    api.rpc.mockResolvedValue({ data: [{ id: edicao.alvoId, nome: "Extintores" }], error: null });
    expect(
      await supabasePlanoManutencaoAdapter.listarAlvos(planoId, "sistema", 20, null, "extin"),
    ).toEqual([{ id: edicao.alvoId, nome: "Extintores" }]);
    expect(api.rpc).toHaveBeenCalledWith("sso_listar_alvos_plano", {
      p_plano_id: planoId,
      p_tipo: "sistema",
      p_limite: 20,
      p_apos: null,
      p_busca: "extin",
    });
  });
});
