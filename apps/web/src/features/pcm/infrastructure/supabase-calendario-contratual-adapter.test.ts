import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabaseCalendarioContratualAdapter } from "./supabase-calendario-contratual-adapter";
const comando = {
  requestId: "16600000-0000-4000-8000-000000000101",
  expectedRevision: 0,
  clienteId: "16600000-0000-4000-8000-00000000000a",
  serieId: "16600000-0000-4000-8000-000000000061",
  regraId: "16600000-0000-4000-8000-000000000071",
  contratoId: "16600000-0000-4000-8000-000000000051",
  ancoraSemana: "2026-10-05",
  diaSemana: 5,
  intervaloSemanas: 1,
  horaInicio: "08:00",
  duracaoMinutos: 120,
  deslocamentoMinutos: 30,
  fuso: "America/Sao_Paulo",
  vigenciaInicio: "2026-10-01",
  vigenciaFim: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  api.schema.mockReturnValue({ rpc: api.rpc });
});
it("envia todos os campos da regra à operação transacional", async () => {
  api.rpc.mockResolvedValue({
    data: {
      aggregateId: comando.serieId,
      revision: 1,
      state: "registrada",
      created: true,
      linkedIds: {
        clienteId: "16600000-0000-4000-8000-00000000000a",
        contratoId: comando.contratoId,
        regraId: comando.regraId,
      },
      warnings: [],
      requestId: comando.requestId,
    },
    error: null,
  });
  const resultado = await supabaseCalendarioContratualAdapter.criarRegra(comando);
  expect(resultado.revision).toBe(1);
  expect(api.schema).toHaveBeenCalledWith("pcm");
  expect(api.rpc).toHaveBeenCalledWith("sso_criar_regra_contratual_v2", {
    p_request_id: comando.requestId,
    p_expected_revision: 0,
    p_serie_id: comando.serieId,
    p_cliente_id: comando.clienteId,
    p_regra_id: comando.regraId,
    p_contrato_id: comando.contratoId,
    p_ancora_semana: "2026-10-05",
    p_dia_semana: 5,
    p_intervalo_semanas: 1,
    p_hora_inicio: "08:00",
    p_duracao_minutos: 120,
    p_deslocamento_minutos: 30,
    p_fuso: "America/Sao_Paulo",
    p_vigencia_inicio: "2026-10-01",
    p_vigencia_fim: null,
  });
});
it("não aceita resposta incompleta nem oculta erro do servidor", async () => {
  api.rpc
    .mockResolvedValueOnce({ data: null, error: new Error("sem acesso") })
    .mockResolvedValueOnce({ data: { revision: 1 }, error: null });
  await expect(supabaseCalendarioContratualAdapter.criarRegra(comando)).rejects.toThrow(
    "sem acesso",
  );
  await expect(supabaseCalendarioContratualAdapter.criarRegra(comando)).rejects.toThrow();
});
it("não confirma operação quando resposta pertence a outro pedido ou entidade", async () => {
  const resposta = {
    aggregateId: comando.serieId,
    revision: 1,
    state: "registrada",
    created: true,
    linkedIds: {
      clienteId: comando.clienteId,
      contratoId: comando.contratoId,
      regraId: comando.regraId,
    },
    warnings: [],
    requestId: comando.requestId,
  };
  for (const alteracao of [
    { requestId: "16600000-0000-4000-8000-000000000102" },
    { aggregateId: "16600000-0000-4000-8000-000000000062" },
    { linkedIds: { ...resposta.linkedIds, clienteId: "16600000-0000-4000-8000-00000000000b" } },
    { linkedIds: { ...resposta.linkedIds, contratoId: "16600000-0000-4000-8000-000000000052" } },
    { linkedIds: { ...resposta.linkedIds, regraId: "16600000-0000-4000-8000-000000000072" } },
    { revision: 2 },
    { state: "cancelada" },
    { created: false },
  ]) {
    api.rpc.mockResolvedValueOnce({ data: { ...resposta, ...alteracao }, error: null });
    await expect(supabaseCalendarioContratualAdapter.criarRegra(comando)).rejects.toThrow();
  }
});
it("lista apenas projeção de contratos do Cliente e preserva cursor", async () => {
  const clienteId = "16600000-0000-4000-8000-00000000000a";
  api.rpc.mockResolvedValue({
    data: [
      {
        id: comando.contratoId,
        tipo: "volante",
        status: "ativo",
        vigencia_inicio: "2026-01-01",
        vigencia_fim: null,
      },
    ],
    error: null,
  });
  expect(await supabaseCalendarioContratualAdapter.listarContratos(clienteId, 20, null)).toEqual([
    {
      id: comando.contratoId,
      tipo: "volante",
      status: "ativo",
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
    },
  ]);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_contratos_calendario", {
    p_cliente_id: clienteId,
    p_limite: 20,
    p_apos: null,
  });
});
it("lista versões de regra com parâmetros operacionais do Cliente", async () => {
  const clienteId = "16600000-0000-4000-8000-00000000000a";
  api.rpc.mockResolvedValue({
    data: [
      {
        id: comando.regraId,
        serie_id: comando.serieId,
        contrato_id: comando.contratoId,
        numero: 1,
        ancora_semana: "2026-10-05",
        dia_semana: 5,
        intervalo_semanas: 1,
        hora_inicio: "08:00:00",
        duracao_minutos: 120,
        deslocamento_minutos: 30,
        fuso: "America/Sao_Paulo",
        vigencia_inicio: "2026-10-01",
        vigencia_fim: null,
      },
    ],
    error: null,
  });
  const regras = await supabaseCalendarioContratualAdapter.listarRegras(clienteId, 20, null);
  expect(regras[0]).toMatchObject({
    id: comando.regraId,
    serieId: comando.serieId,
    contratoId: comando.contratoId,
    diaSemana: 5,
    duracaoMinutos: 120,
  });
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_regras_calendario", {
    p_cliente_id: clienteId,
    p_limite: 20,
    p_apos: null,
  });
});
