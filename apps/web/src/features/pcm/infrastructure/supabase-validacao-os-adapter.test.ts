import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabaseValidacaoOsAdapter } from "./supabase-validacao-os-adapter";

const clienteId = "16800000-0000-4000-8000-000000000002";
const retornoId = "16800000-0000-4000-8000-000000000038";
const requestId = "16800000-0000-4000-8000-000000000101";

beforeEach(() => {
  vi.resetAllMocks();
  api.schema.mockReturnValue({ rpc: api.rpc });
});

it("lista retornos classificáveis e converte pra camelCase", async () => {
  api.rpc.mockResolvedValueOnce({
    data: [
      {
        envelope_id: retornoId,
        resolucao_id: retornoId,
        os_id: retornoId,
        task_id: "168910001",
        ocorrido_em: "2026-11-01T10:00:00Z",
        recebido_em: "2026-11-01T10:00:05Z",
        perguntas: [{ id: "p1", texto: "Disjuntor íntegro?" }],
      },
    ],
    error: null,
  });
  const resultado = await supabaseValidacaoOsAdapter.listarRetornosClassificaveis({
    clienteId,
    apos: null,
    limite: 20,
  });
  expect(resultado).toEqual([
    {
      envelopeId: retornoId,
      resolucaoId: retornoId,
      osId: retornoId,
      taskId: "168910001",
      ocorridoEm: "2026-11-01T10:00:00Z",
      recebidoEm: "2026-11-01T10:00:05Z",
      perguntas: [{ id: "p1", texto: "Disjuntor íntegro?" }],
    },
  ]);
  expect(api.schema).toHaveBeenCalledWith("pcm");
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_retornos_classificaveis_mediada", {
    p_cliente_id: clienteId,
    p_apos: null,
    p_limite: 20,
  });
});

it("recusa paginação inválida antes de chamar o servidor", async () => {
  await expect(
    supabaseValidacaoOsAdapter.listarRetornosClassificaveis({ clienteId, apos: null, limite: 0 }),
  ).rejects.toThrow("Paginação inválida.");
  expect(api.rpc).not.toHaveBeenCalled();
});

it("classifica retorno chamando a RPC mediada com os parâmetros certos", async () => {
  const comando = {
    requestId,
    clienteId,
    envelopeId: retornoId,
    resolucaoId: retornoId,
    retornoId,
    respostas: [{ perguntaId: "p1", resultado: "ok" as const, observacao: null }],
  };
  api.rpc.mockResolvedValueOnce({
    data: { requestId, retornoId, coberturaComprovada: false },
    error: null,
  });
  expect(await supabaseValidacaoOsAdapter.classificarRetorno(comando)).toEqual({
    requestId,
    retornoId,
    coberturaComprovada: false,
  });
  expect(api.rpc).toHaveBeenCalledWith("sso_classificar_retorno_campo_mediada", {
    p_request_id: requestId,
    p_cliente_id: clienteId,
    p_envelope_id: retornoId,
    p_resolucao_id: retornoId,
    p_retorno_id: retornoId,
    p_respostas: comando.respostas,
  });
});

it("rejeita resposta de classificação de outro retornoId", async () => {
  const comando = {
    requestId,
    clienteId,
    envelopeId: retornoId,
    resolucaoId: retornoId,
    retornoId,
    respostas: [{ perguntaId: "p1", resultado: "ok" as const, observacao: null }],
  };
  api.rpc.mockResolvedValueOnce({
    data: {
      requestId,
      retornoId: "16800000-0000-4000-8000-000000000099",
      coberturaComprovada: false,
    },
    error: null,
  });
  await expect(supabaseValidacaoOsAdapter.classificarRetorno(comando)).rejects.toThrow();
});

it("confere cobertura e devolve só os campos do contrato", async () => {
  api.rpc.mockResolvedValueOnce({
    data: {
      conferenciaId: requestId,
      retornoId,
      coberturaEstrutural: true,
      evidenciaExternaComprovada: false,
      requestId,
    },
    error: null,
  });
  const resultado = await supabaseValidacaoOsAdapter.conferirCoberturaRetorno({
    requestId,
    clienteId,
    retornoId,
    evidenciaId: null,
    expectedEvidencias: 0,
    justificativa: "Conferência de campo",
  });
  expect(resultado).toEqual({ conferenciaId: requestId, retornoId, requestId });
  expect(api.rpc).toHaveBeenCalledWith("sso_conferir_cobertura_mediada", {
    p_request_id: requestId,
    p_cliente_id: clienteId,
    p_retorno_id: retornoId,
    p_evidencia_id: null,
    p_expected_evidencias: 0,
    p_justificativa: "Conferência de campo",
  });
});

it("aprova e finaliza a OS na mesma chamada atômica", async () => {
  const osId = "16800000-0000-4000-8000-000000000017";
  const comando = {
    requestId,
    clienteId,
    retornoId,
    conferenciaId: requestId,
    expectedEvidencias: 0,
    expectedDecisao: 0,
    justificativa: "Atestação de campo",
    expectedOsId: osId,
    expectedStatus: "em_execucao",
    expectedUpdatedAt: "2026-11-01T10:00:00Z",
  };
  api.rpc.mockResolvedValueOnce({
    data: {
      requestId,
      retornoId,
      osId,
      revision: 1,
      pendenciasProcessadas: 1,
      osEncerrada: true,
      chamadoAlterado: false,
      conteudoAutenticado: false,
    },
    error: null,
  });
  const resultado = await supabaseValidacaoOsAdapter.aprovarFinalizarOs(comando);
  expect(resultado.osEncerrada).toBe(true);
  expect(resultado.pendenciasProcessadas).toBe(1);
  expect(api.rpc).toHaveBeenCalledWith("sso_aprovar_finalizar_os_atomico", {
    p_request_id: requestId,
    p_cliente_id: clienteId,
    p_retorno_id: retornoId,
    p_conferencia_id: requestId,
    p_expected_evidencias: 0,
    p_expected_decisao: 0,
    p_justificativa: "Atestação de campo",
    p_expected_os_id: osId,
    p_expected_status: "em_execucao",
    p_expected_updated_at: "2026-11-01T10:00:00Z",
  });
});

it("propaga erro do servidor sem mascarar", async () => {
  api.rpc.mockResolvedValueOnce({ data: null, error: new Error("sem acesso") });
  await expect(
    supabaseValidacaoOsAdapter.conferirCoberturaRetorno({
      requestId,
      clienteId,
      retornoId,
      evidenciaId: null,
      expectedEvidencias: 0,
      justificativa: "x",
    }),
  ).rejects.toThrow("sem acesso");
});
