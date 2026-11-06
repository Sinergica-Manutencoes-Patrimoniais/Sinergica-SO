import { beforeEach, expect, it, vi } from "vitest";

const rede = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../../lib/supabase-client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://sso-test.invalid", "chave-teste", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: rede.fetch },
    }),
  };
});
import { supabaseCalendarioContratualAdapter as adapter } from "./supabase-calendario-contratual-adapter";

const clienteId = "16600000-0000-4000-8000-00000000000a";
const contratoId = "16600000-0000-4000-8000-000000000051";
const serieId = "16600000-0000-4000-8000-000000000061";
const regraId = "16600000-0000-4000-8000-000000000071";
const requestId = "16600000-0000-4000-8000-000000000101";
const comando = {
  requestId,
  expectedRevision: 0,
  clienteId,
  serieId,
  regraId,
  contratoId,
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
function resposta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
beforeEach(() => rede.fetch.mockReset());

it("serializa criação com identidade, revisão e parâmetros completos pelo SDK", async () => {
  rede.fetch.mockResolvedValue(
    resposta({
      aggregateId: serieId,
      revision: 1,
      state: "registrada",
      created: true,
      linkedIds: { clienteId, contratoId, regraId },
      warnings: [],
      requestId,
    }),
  );
  expect(await adapter.criarRegra(comando)).toMatchObject({ aggregateId: serieId, requestId });
  const chamada = rede.fetch.mock.calls[0];
  if (!chamada) throw new Error("Consulta HTTP não realizada.");
  const [url, init] = chamada;
  expect(String(url)).toBe("https://sso-test.invalid/rest/v1/rpc/sso_criar_regra_contratual_v2");
  expect(init.method).toBe("POST");
  expect(new Headers(init.headers).get("content-profile")).toBe("pcm");
  expect(JSON.parse(init.body)).toEqual({
    p_request_id: requestId,
    p_expected_revision: 0,
    p_cliente_id: clienteId,
    p_serie_id: serieId,
    p_regra_id: regraId,
    p_contrato_id: contratoId,
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

it("propaga conflito e negação de acesso sem confirmar alteração", async () => {
  rede.fetch.mockResolvedValueOnce(resposta({ code: "42501", message: "sem acesso" }, 403));
  rede.fetch.mockResolvedValueOnce(resposta({ code: "409", message: "revisão conflitante" }, 409));
  await expect(adapter.criarRegra(comando)).rejects.toMatchObject({ code: "42501" });
  await expect(adapter.criarRegra(comando)).rejects.toMatchObject({
    message: "revisão conflitante",
  });
});

it("passa cursor, escopo e cancelamento na consulta de regras", async () => {
  rede.fetch.mockResolvedValue(resposta([]));
  const controle = new AbortController();
  await expect(adapter.listarRegras(clienteId, 20, regraId, controle.signal)).resolves.toEqual([]);
  const chamada = rede.fetch.mock.calls[0];
  if (!chamada) throw new Error("Consulta HTTP não realizada.");
  const [url, init] = chamada;
  expect(String(url)).toBe("https://sso-test.invalid/rest/v1/rpc/sso_listar_regras_calendario");
  expect(init.signal).toBe(controle.signal);
  expect(JSON.parse(init.body)).toEqual({ p_cliente_id: clienteId, p_limite: 20, p_apos: regraId });
});

it("recusa projeção inesperada e falha de rede sem apresentar lista vazia", async () => {
  rede.fetch.mockResolvedValueOnce(resposta([{ id: contratoId, campo_extra: "inesperado" }]));
  rede.fetch.mockRejectedValueOnce(new TypeError("falha de rede"));
  await expect(adapter.listarContratos(clienteId, 20, null)).rejects.toThrow();
  await expect(adapter.listarContratos(clienteId, 20, null)).rejects.toMatchObject({
    message: "TypeError: falha de rede",
  });
});
