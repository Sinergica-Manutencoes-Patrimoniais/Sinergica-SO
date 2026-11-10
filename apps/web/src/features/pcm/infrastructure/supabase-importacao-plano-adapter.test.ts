import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { receberMatrizCronograma, anotarRevisaoCronograma, listarCronogramasStaging, obterCronogramaStaging, classificarLinhaCronograma, mapearLinhaCronograma, listarMapeamentosCronograma, listarAlvosCronograma, identificarLinhaCronograma, conferirLinhasCronograma, aprovarCronogramaStaging, incorporarLoteCronograma, salvarToleranciaCronograma, obterToleranciaCronograma, proporReprocessamentoCronograma, aplicarReprocessamentoCronograma, listarPropostasReprocessamento } from "./supabase-importacao-plano-adapter";

beforeEach(() => { vi.resetAllMocks(); api.schema.mockReturnValue({ rpc: api.rpc }); });

it("recebe e anota usando somente mediação e mantém revisão", async () => {
  api.rpc.mockResolvedValueOnce({ data: { aggregateId: "lote", requestId: "req", revision: 1, state: "pendente" }, error: null });
  await receberMatrizCronograma({ requestId: "req", loteId: "lote", clienteId: "cliente", fonteId: "fonte", matriz: [[1]] });
  expect(api.rpc).toHaveBeenCalledWith("sso_receber_cronograma_mediado", { p_request: "req", p_lote: "lote", p_cliente: "cliente", p_fonte: "fonte", p_matriz: [[1]] });
  api.rpc.mockResolvedValueOnce({ data: { aggregateId: "lote", requestId: "req2", revision: 2, state: "pendente" }, error: null });
  await anotarRevisaoCronograma({ requestId: "req2", loteId: "lote", expectedRevision: 1, numeroLinha: 1, observacao: "Conferido" });
  expect(api.rpc).toHaveBeenCalledWith("sso_anotar_cronograma_mediado", { p_request: "req2", p_lote: "lote", p_revision: 1, p_linha: 1, p_observacao: "Conferido" });
});

it("consulta mediação por Cliente e propaga recusa", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: "lote", fonte_id: "fonte", revisao: 1, criado_em: "2026-01-01" }], error: null });
  expect(await listarCronogramasStaging("cliente", null)).toHaveLength(1);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_cronogramas_mediado", { p_cliente: "cliente", p_apos: null, p_limite: 20 });
  api.rpc.mockResolvedValueOnce({ data: null, error: new Error("lote_sem_acesso") });
  await expect(obterCronogramaStaging("outro", "lote")).rejects.toThrow("lote_sem_acesso");
  expect(api.rpc).toHaveBeenCalledWith("sso_obter_cronograma_mediado", { p_cliente: "outro", p_lote: "lote" });
});

it("classifica e mapeia apenas por funções mediadas", async () => {
  api.rpc.mockResolvedValueOnce({ data: {}, error: null });
  await classificarLinhaCronograma({ requestId: "req", loteId: "lote", expectedRevision: 1, chave: "1", tipo: "dado", conferencia: "pendente", justificativa: "Conferir" });
  expect(api.rpc).toHaveBeenCalledWith("sso_classificar_cronograma_mediado", expect.objectContaining({ p_lote_id: "lote", p_expected_revision: 1 }));
  api.rpc.mockResolvedValueOnce({ data: { aggregateId: "lote", requestId: "req2", revision: 3, state: "pendente" }, error: null });
  await mapearLinhaCronograma({ requestId: "req2", loteId: "lote", expectedRevision: 2, numeroLinha: 1, disciplina: "Elétrica", nomeRotina: "Rotina", alvoTipo: "sistema", alvoId: "alvo", modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-01-01", tempoMinutos: null, premissaMensal: "calendario_real" });
  expect(api.rpc).toHaveBeenCalledWith("sso_mapear_cronograma_mediado", expect.objectContaining({ p_lote_id: "lote", p_alvo_id: "alvo" }));
  api.rpc.mockResolvedValueOnce({ data: [], error: null });
  await listarMapeamentosCronograma("cliente", "lote", null);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_mapeamentos_mediado", expect.objectContaining({ p_cliente_id: "cliente", p_lote_id: "lote" }));
  api.rpc.mockResolvedValueOnce({ data: [], error: null });
  await listarAlvosCronograma("cliente", "sistema", "", null);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_alvos_cronograma_mediado", expect.objectContaining({ p_cliente_id: "cliente", p_tipo: "sistema" }));
});

it("media conferência, aprovação e incorporação preservando revisão e cliente", async () => {
  api.rpc.mockResolvedValueOnce({ data: {}, error: null });
  await identificarLinhaCronograma({ requestId: "i", loteId: "lote", expectedRevision: 1, chaveLinha: "1", identidade: "origem" });
  expect(api.rpc).toHaveBeenCalledWith("sso_identificar_cronograma_mediado", expect.objectContaining({ p_lote_id: "lote", p_expected_revision: 1 }));
  api.rpc.mockResolvedValueOnce({ data: [], error: null });
  await conferirLinhasCronograma("cliente", "lote", null);
  expect(api.rpc).toHaveBeenCalledWith("sso_conferir_cronograma_mediado", expect.objectContaining({ p_cliente_id: "cliente", p_lote_id: "lote" }));
  api.rpc.mockResolvedValueOnce({ data: {}, error: null });
  await aprovarCronogramaStaging({ requestId: "a", clienteId: "cliente", loteId: "lote", expectedRevision: 2, justificativa: "Aprovado" });
  expect(api.rpc).toHaveBeenCalledWith("sso_aprovar_cronograma_mediado", expect.objectContaining({ p_cliente_id: "cliente", p_expected_revision: 2 }));
  const requestId = "00000000-0000-4000-8000-000000000001";
  const planoId = "00000000-0000-4000-8000-000000000002";
  const rotinaId = "00000000-0000-4000-8000-000000000003";
  api.rpc.mockResolvedValueOnce({ data: { aggregateId: planoId, revision: 2, state: "rascunho", requestId, linhas: [{ chave: "1", rotinaId, requestId: "00000000-0000-4000-8000-000000000004", revision: 2 }] }, error: null });
  await incorporarLoteCronograma({ requestId, clienteId: "cliente", loteId: "lote", loteRevision: 3, planoId, planoRevision: 1, linhas: [{ chave: "1", rotinaId }] });
  expect(api.rpc).toHaveBeenCalledWith("sso_incorporar_lote_cronograma_mediado", expect.objectContaining({ p_cliente_id: "cliente", p_expected_lote_revision: 3, p_expected_plano_revision: 1 }));
});

it("media tolerância e reprocessamento sem chamar núcleos privados", async () => {
  api.rpc.mockResolvedValueOnce({ data: {}, error: null });
  await salvarToleranciaCronograma({ requestId: "t", loteId: "lote", expectedRevision: 1, chave: "1", mapeamentoId: "mapa", antes: 1, depois: 2 });
  expect(api.rpc).toHaveBeenCalledWith("sso_tolerancia_cronograma_mediada", expect.objectContaining({ p_lote_id: "lote", p_antes: 1, p_depois: 2 }));
  api.rpc.mockResolvedValueOnce({ data: { antes: 1, depois: 2, configurada: true }, error: null });
  await obterToleranciaCronograma("cliente", "lote", "mapa");
  expect(api.rpc).toHaveBeenCalledWith("sso_obter_tolerancia_mediada", expect.objectContaining({ p_cliente_id: "cliente", p_mapeamento_id: "mapa" }));
  api.rpc.mockResolvedValueOnce({ data: {}, error: null });
  await proporReprocessamentoCronograma({ requestId: "p", clienteId: "cliente", loteId: "lote", loteRevision: 4, chave: "1", planoId: "plano", planoRevision: 2, justificativa: "Revisão" });
  expect(api.rpc).toHaveBeenCalledWith("sso_propor_reprocessamento_mediado", expect.objectContaining({ p_cliente_id: "cliente", p_expected_lote_revision: 4 }));
  api.rpc.mockResolvedValueOnce({ data: [], error: null });
  await listarPropostasReprocessamento("cliente", "lote", "plano", null);
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_reprocessamentos_mediado", expect.objectContaining({ p_cliente_id: "cliente", p_plano_id: "plano" }));
  api.rpc.mockResolvedValueOnce({ data: {}, error: null });
  await aplicarReprocessamentoCronograma({ requestId: "a", clienteId: "cliente", propostaId: "proposta" });
  expect(api.rpc).toHaveBeenCalledWith("sso_aplicar_reprocessamento_mediado", expect.objectContaining({ p_cliente_id: "cliente", p_proposta_id: "proposta" }));
});
