import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, schema } = vi.hoisted(() => ({ rpc: vi.fn(), schema: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema } }));
import { alterarDiaContratual, supabaseCalendarioContratualAdapter } from "./supabase-calendario-contratual-adapter";

const id = (n: number) => `16630000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeEach(() => {
  rpc.mockReset();
  schema.mockReset().mockReturnValue({ rpc });
});

describe("adapter S166 calendario contratual", () => {
  it("encaminha criação com revisão, escopo do Cliente e requestId e valida o recibo", async () => {
    const comando = {
      requestId: id(1), expectedRevision: 0, clienteId: id(2), serieId: id(3), regraId: id(4), contratoId: id(5),
      ancoraSemana: "2026-10-05", diaSemana: 2, intervaloSemanas: 1, horaInicio: "09:00", duracaoMinutos: 45,
      deslocamentoMinutos: 0, fuso: "America/Sao_Paulo", vigenciaInicio: "2026-10-05", vigenciaFim: null,
    };
    const recibo = {
      aggregateId: id(3), revision: 1, state: "registrada", created: true,
      linkedIds: { clienteId: id(2), contratoId: id(5), regraId: id(4) }, warnings: [], requestId: id(1),
    };
    rpc.mockResolvedValue({ data: recibo, error: null, status: 200 });

    await expect(supabaseCalendarioContratualAdapter.criarRegra(comando)).resolves.toEqual(recibo);
    expect(schema).toHaveBeenCalledWith("pcm");
    expect(rpc).toHaveBeenCalledWith("sso_criar_regra_contratual_v2", {
      p_request_id: id(1), p_expected_revision: 0, p_cliente_id: id(2), p_serie_id: id(3), p_regra_id: id(4),
      p_contrato_id: id(5), p_ancora_semana: "2026-10-05", p_dia_semana: 2, p_intervalo_semanas: 1,
      p_hora_inicio: "09:00", p_duracao_minutos: 45, p_deslocamento_minutos: 0, p_fuso: "America/Sao_Paulo",
      p_vigencia_inicio: "2026-10-05", p_vigencia_fim: null,
    });
  });

  it("encaminha alteração de dia sem alterar o contrato do RPC legado e rejeita recibo divergente", async () => {
    const pedido = { requestId: id(11), serieId: id(12), regraNovaId: id(13), expectedRevision: 4, diaSemana: 2, vigencia: "2026-12-07" };
    rpc.mockResolvedValueOnce({ data: { requestId: id(11), serieId: id(12), regraId: id(13), revision: 5 }, error: null });
    await expect(alterarDiaContratual(pedido)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("sso_alterar_dia_contratual", {
      p_request_id: id(11), p_serie_id: id(12), p_regra_nova_id: id(13), p_expected_revision: 4, p_dia_semana: 2, p_vigencia: "2026-12-07",
    });
    rpc.mockResolvedValueOnce({ data: { requestId: id(11), serieId: id(12), regraId: id(99), revision: 5 }, error: null });
    await expect(alterarDiaContratual(pedido)).rejects.toThrow("Resposta de alteração inválida.");
  });

  it("mapeia respostas paginadas, repassa AbortSignal e rejeita erro do servidor", async () => {
    const consulta = Object.assign(Promise.resolve({ data: [{
      id: id(21), serie_id: id(22), contrato_id: id(23), numero: 2, ancora_semana: "2026-10-05", dia_semana: 2,
      intervalo_semanas: 1, hora_inicio: "09:00:00", duracao_minutos: 45, deslocamento_minutos: 10,
      fuso: "America/Sao_Paulo", vigencia_inicio: "2026-10-05", vigencia_fim: null,
    }], error: null }), { abortSignal: vi.fn().mockResolvedValue({ data: [{
      id: id(21), serie_id: id(22), contrato_id: id(23), numero: 2, ancora_semana: "2026-10-05", dia_semana: 2,
      intervalo_semanas: 1, hora_inicio: "09:00:00", duracao_minutos: 45, deslocamento_minutos: 10,
      fuso: "America/Sao_Paulo", vigencia_inicio: "2026-10-05", vigencia_fim: null,
    }], error: null }) });
    rpc.mockReturnValueOnce(consulta);
    const signal = new AbortController().signal;
    await expect(supabaseCalendarioContratualAdapter.listarRegras(id(2), 20, null, signal)).resolves.toEqual([{
      id: id(21), serieId: id(22), contratoId: id(23), numero: 2, ancoraSemana: "2026-10-05", diaSemana: 2,
      intervaloSemanas: 1, horaInicio: "09:00:00", duracaoMinutos: 45, deslocamentoMinutos: 10,
      fuso: "America/Sao_Paulo", vigenciaInicio: "2026-10-05", vigenciaFim: null,
    }]);
    expect(consulta.abortSignal).toHaveBeenCalledWith(signal);
    await expect(supabaseCalendarioContratualAdapter.listarContratos(id(2), 101, null)).rejects.toThrow("Paginação inválida.");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "sem_acesso" } });
    await expect(supabaseCalendarioContratualAdapter.criarRegra({} as never)).rejects.toMatchObject({ code: "42501" });
  });
});
