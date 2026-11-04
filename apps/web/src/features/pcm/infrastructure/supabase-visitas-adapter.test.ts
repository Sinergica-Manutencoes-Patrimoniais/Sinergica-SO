import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ schema: vi.fn(), rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { criarOperacoesVisita } from "../application/visitas";
import { supabaseVisitasAdapter } from "./supabase-visitas-adapter";

const visitaId = "17100000-0000-4000-8000-000000000064";
const requestId = "17100000-0000-4000-8000-000000000101";
const base = { requestId, expectedRevision: 7, visitaId };
const resultado = { aggregateId: visitaId, revision: 8, state: "confirmada", created: false,
  linkedIds: { clienteId: "17100000-0000-4000-8000-00000000000a" }, warnings: [], requestId };

it("consulta posições no escopo da Visita e transforma Área do Local", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: visitaId, nome: "Casa de máquinas", area_id: requestId }], error: null });
  const consulta = { clienteId: requestId, visitaId, tipo: "local" as const, areaId: requestId, busca: "Casa", limite: 20, apos: null };
  expect(await supabaseVisitasAdapter.selecionarPosicoes(consulta)).toEqual([{ id: visitaId, nome: "Casa de máquinas", areaId: requestId }]);
  expect(api.rpc).toHaveBeenCalledWith("sso_selecionar_posicoes_visita", { p_cliente_id: requestId, p_visita_id: visitaId, p_tipo: "local", p_area_id: requestId, p_busca: "Casa", p_limite: 20, p_apos: null });
});

beforeEach(() => {
  vi.resetAllMocks();
  api.schema.mockReturnValue({ rpc: api.rpc });
  api.rpc.mockResolvedValue({ data: resultado, error: null });
});

it("confirma a revisão conferida usando o comando transacional", async () => {
  expect(await supabaseVisitasAdapter.confirmar(base)).toEqual(resultado);
  expect(api.schema).toHaveBeenCalledWith("pcm");
  expect(api.rpc).toHaveBeenCalledWith("sso_confirmar_visita", {
    p_request_id: requestId, p_expected_revision: 7, p_visita_id: visitaId,
  });
});

it("envia dados completos de ciência sem converter confirmação PCM em envio", async () => {
  const comando = { ...base, cienciaEm: "2026-10-20T12:00:00Z", responsavel: "Síndica", canal: "Telefone", observacao: "Ciente" };
  api.rpc.mockResolvedValueOnce({ data: { ...resultado, linkedIds: { clienteId: visitaId, cienciaId: requestId, confirmacaoId: null } }, error: null });
  expect((await supabaseVisitasAdapter.registrarCiencia(comando)).linkedIds.confirmacaoId).toBeNull();
  expect(api.rpc).toHaveBeenCalledWith("sso_registrar_ciencia_visita", {
    p_request_id: requestId, p_expected_revision: 7, p_visita_id: visitaId,
    p_ciencia_em: comando.cienciaEm, p_responsavel: "Síndica", p_canal: "Telefone", p_observacao: "Ciente",
  });
});

it("consulta conferência informativa e rejeita resposta que afirme autorizar envio", async () => {
  const conferencia = { visitaId, revision: 8, situacao: "ciencia_pendente", politicaModo: "obrigatoria",
    politicaOrigem: "cliente", politicaId: requestId, politicaRevisao: 1, confirmacaoId: requestId,
    cienciaEncontrada: false, autorizaEnvio: false };
  api.rpc.mockResolvedValueOnce({ data: conferencia, error: null });
  expect(await supabaseVisitasAdapter.conferirCiencia(visitaId)).toEqual(conferencia);
  expect(api.rpc).toHaveBeenCalledWith("sso_conferir_ciencia_visita", { p_visita_id: visitaId });
  api.rpc.mockResolvedValueOnce({ data: { ...conferencia, autorizaEnvio: true }, error: null });
  await expect(supabaseVisitasAdapter.conferirCiencia(visitaId)).rejects.toThrow();
  api.rpc.mockResolvedValueOnce({ data: { ...conferencia, visitaId: requestId }, error: null });
  await expect(supabaseVisitasAdapter.conferirCiencia(visitaId)).rejects.toThrow();
});

it("propaga erro do servidor e rejeita resultado incompleto", async () => {
  api.rpc.mockResolvedValueOnce({ data: null, error: new Error("sem acesso") });
  api.rpc.mockResolvedValueOnce({ data: { revision: 8 }, error: null });
  await expect(supabaseVisitasAdapter.confirmar(base)).rejects.toThrow("sem acesso");
  await expect(supabaseVisitasAdapter.confirmar(base)).rejects.toThrow();
});

it("não confirma resposta de outra Visita ou requestId ao alterar equipe e confirmar", async () => {
  for (const resposta of [
    { ...resultado, aggregateId: "17100000-0000-4000-8000-000000000065" },
    { ...resultado, requestId: "17100000-0000-4000-8000-000000000102" },
  ]) {
    api.rpc.mockResolvedValueOnce({ data: resposta, error: null });
    await expect(supabaseVisitasAdapter.confirmar(base)).rejects.toThrow();
    api.rpc.mockResolvedValueOnce({ data: resposta, error: null });
    await expect(supabaseVisitasAdapter.adicionarMembro({ ...base, funcionarioId: visitaId, participacaoId: requestId, papel: "Técnico", estimativaMinutos: null })).rejects.toThrow();
  }
});

it("mantém pedido pendente se confirmação retorna identidade divergente", async () => {
  const dados = new Map<string, string>();
  const armazenamento = {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => { dados.set(chave, valor); },
    removeItem: (chave: string) => { dados.delete(chave); },
  };
  const operacoes = criarOperacoesVisita(supabaseVisitasAdapter, armazenamento, {
    usuarioId: requestId, clienteId: "17100000-0000-4000-8000-00000000000a", visitaId,
  });
  api.rpc.mockResolvedValueOnce({ data: { ...resultado, requestId: "17100000-0000-4000-8000-000000000102" }, error: null });
  await expect(operacoes.iniciar({ tipo: "confirmar", comando: base })).rejects.toThrow();
  expect(operacoes.pendente()).toEqual({ tipo: "confirmar", comando: base });
  await expect(operacoes.repetir()).resolves.toEqual(resultado);
  expect(operacoes.pendente()).toBeNull();
});

it("cria e edita Visita preservando posição, janela e responsável", async () => {
  const dados = { ...base, clienteId: visitaId, contratoId: null, areaId: null, localId: null,
    inicioEm: "2026-11-01T11:00:00Z", fimEm: "2026-11-01T13:00:00Z", fuso: "America/Sao_Paulo",
    natureza: "extra" as const, responsavelId: null, deslocamentoMinutos: 30 };
  await supabaseVisitasAdapter.criar({ ...dados, expectedRevision: 0 });
  expect(api.rpc).toHaveBeenLastCalledWith("sso_criar_visita_rascunho", {
    p_request_id: requestId, p_expected_revision: 0, p_visita_id: visitaId, p_cliente_id: visitaId,
    p_contrato_id: null, p_area_id: null, p_local_id: null, p_inicio_em: dados.inicioEm,
    p_fim_em: dados.fimEm, p_fuso: dados.fuso, p_natureza: "extra", p_responsavel_id: null, p_deslocamento_minutos: 30,
  });
  await supabaseVisitasAdapter.editar(dados);
  expect(api.rpc).toHaveBeenLastCalledWith("sso_editar_visita", {
    p_request_id: requestId, p_expected_revision: 7, p_visita_id: visitaId, p_area_id: null, p_local_id: null,
    p_inicio_em: dados.inicioEm, p_fim_em: dados.fimEm, p_fuso: dados.fuso, p_responsavel_id: null, p_deslocamento_minutos: 30,
  });
});

it("associa OS com vínculo, sequência e estimativa", async () => {
  await supabaseVisitasAdapter.associarOs({ ...base, osId: visitaId, vinculoId: requestId, sequencia: 2, estimativaMinutos: 45 });
  expect(api.rpc).toHaveBeenCalledWith("sso_associar_os_visita", {
    p_request_id: requestId, p_expected_revision: 7, p_visita_id: visitaId, p_os_id: visitaId,
    p_vinculo_id: requestId, p_sequencia: 2, p_estimativa_minutos: 45,
  });
});

it("envia desvinculação com revisão, vínculo e motivo ao comando correto", async () => {
  await supabaseVisitasAdapter.desvincularOs({ ...base, vinculoId: requestId, motivo: "Reprogramação" });
  expect(api.rpc).toHaveBeenCalledWith("sso_desvincular_os_visita", {
    p_request_id: requestId, p_expected_revision: 7, p_visita_id: visitaId, p_vinculo_id: requestId, p_motivo: "Reprogramação",
  });
});

it("inclui e encerra participação sem apagar histórico", async () => {
  await supabaseVisitasAdapter.adicionarMembro({ ...base, funcionarioId: visitaId, participacaoId: requestId, papel: "Técnico", estimativaMinutos: null });
  expect(api.rpc).toHaveBeenLastCalledWith("sso_adicionar_membro_visita", {
    p_request_id: requestId, p_expected_revision: 7, p_visita_id: visitaId, p_funcionario_id: visitaId,
    p_participacao_id: requestId, p_papel: "Técnico", p_estimativa_minutos: null,
  });
  await supabaseVisitasAdapter.encerrarMembro({ ...base, participacaoId: requestId, motivo: "Mudança" });
  expect(api.rpc).toHaveBeenLastCalledWith("sso_encerrar_membro_visita", {
    p_request_id: requestId, p_expected_revision: 7, p_visita_id: visitaId, p_participacao_id: requestId, p_motivo: "Mudança",
  });
});

it("planeja sem confirmar e configura política em escopo explícito", async () => {
  await supabaseVisitasAdapter.planejar(base);
  expect(api.rpc).toHaveBeenLastCalledWith("sso_planejar_visita", {
    p_request_id: requestId, p_expected_revision: 7, p_visita_id: visitaId,
  });
  await supabaseVisitasAdapter.configurarCiencia({ requestId, expectedRevision: 0, politicaId: requestId,
    clienteId: visitaId, contratoId: null, visitaId: null, modo: "obrigatoria" });
  expect(api.rpc).toHaveBeenLastCalledWith("sso_configurar_ciencia_visita", {
    p_request_id: requestId, p_expected_revision: 0, p_politica_id: requestId, p_cliente_id: visitaId,
    p_contrato_id: null, p_visita_id: null, p_modo: "obrigatoria",
  });
});

it("lista Visitas de um Cliente com intervalo e cursor composto", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: visitaId, cliente_id: requestId, inicio_em: "2026-11-01T11:00:00+00:00",
    fim_em: "2026-11-01T13:00:00+00:00", fuso: "America/Sao_Paulo", natureza: "extra", estado: "planejada", revisao: 3, responsavel_id: null }], error: null });
  const consulta = { clienteId: requestId, inicio: "2026-11-01T00:00:00Z", fim: "2026-12-01T00:00:00Z", limite: 20,
    apos: { inicio: "2026-11-01T10:00:00Z", id: requestId } };
  const visitas = await supabaseVisitasAdapter.listar(consulta);
  expect(visitas[0]).toMatchObject({ id: visitaId, clienteId: requestId, revisao: 3, estado: "planejada" });
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_visitas", { p_cliente_id: requestId, p_inicio: consulta.inicio,
    p_fim: consulta.fim, p_limite: 20, p_apos_inicio: consulta.apos.inicio, p_apos_id: requestId });
  api.rpc.mockResolvedValueOnce({ data: [{ id: visitaId, cliente_id: visitaId, inicio_em: "2026-11-01T11:00:00+00:00",
    fim_em: "2026-11-01T13:00:00+00:00", fuso: "America/Sao_Paulo", natureza: "extra", estado: "planejada", revisao: 3, responsavel_id: null }], error: null });
  await expect(supabaseVisitasAdapter.listar(consulta)).rejects.toThrow();
});

it("detalha Visita com contagens e recusa limite excessivo", async () => {
  const detalhe = { id: visitaId, clienteId: requestId, contratoId: null, areaId: null, localId: null,
    inicioEm: "2026-11-01T11:00:00+00:00", fimEm: "2026-11-01T13:00:00+00:00", fuso: "America/Sao_Paulo",
    natureza: "extra", estado: "rascunho", responsavelId: null, deslocamentoMinutos: 30, revisao: 2, quantidadeOs: 2, quantidadeEquipe: 1 };
  api.rpc.mockResolvedValueOnce({ data: detalhe, error: null });
  expect(await supabaseVisitasAdapter.detalhar(requestId, visitaId)).toEqual(detalhe);
  expect(api.rpc).toHaveBeenCalledWith("sso_detalhar_visita", { p_cliente_id: requestId, p_visita_id: visitaId });
  api.rpc.mockResolvedValueOnce({ data: { ...detalhe, clienteId: visitaId }, error: null });
  await expect(supabaseVisitasAdapter.detalhar(requestId, visitaId)).rejects.toThrow();
  api.rpc.mockResolvedValueOnce({ data: { ...detalhe, id: requestId }, error: null });
  await expect(supabaseVisitasAdapter.detalhar(requestId, visitaId)).rejects.toThrow();
  await expect(supabaseVisitasAdapter.listar({ clienteId: requestId, inicio: "2026-11-01T00:00:00Z", fim: "2026-12-01T00:00:00Z", limite: 101, apos: null })).rejects.toThrow();
});

it("lista OS paginadas preservando sequência e histórico", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: requestId, os_id: visitaId, numero: "OS-1", titulo: "Inspeção", categoria: "preventiva",
    sequencia: 2, estimativa_minutos: 30, created_at: "2026-10-01T10:00:00Z", encerrado_em: null, encerrado_por: null, encerramento_motivo: null }], error: null });
  const result = await supabaseVisitasAdapter.listarOs({ clienteId: requestId, visitaId, incluirHistorico: true, limite: 10,
    apos: { sequencia: 1, id: requestId } });
  expect(result[0]).toMatchObject({ id: requestId, osId: visitaId, numero: "OS-1", sequencia: 2, encerradoEm: null });
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_os_visita", { p_cliente_id: requestId, p_visita_id: visitaId,
    p_incluir_historico: true, p_limite: 10, p_apos_sequencia: 1, p_apos_id: requestId });
});

it("lista equipe paginada com motivo de encerramento", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: requestId, funcionario_id: visitaId, nome: "Técnico", papel: "Apoio",
    estimativa_minutos: null, created_at: "2026-10-01T10:00:00Z", encerrado_em: "2026-10-02T10:00:00Z",
    encerrado_por: requestId, encerramento_motivo: "Mudança" }], error: null });
  const result = await supabaseVisitasAdapter.listarEquipe({ clienteId: requestId, visitaId, incluirHistorico: true, limite: 10, aposId: requestId });
  expect(result[0]).toMatchObject({ funcionarioId: visitaId, nome: "Técnico", encerramentoMotivo: "Mudança" });
  expect(api.rpc).toHaveBeenCalledWith("sso_listar_equipe_visita", { p_cliente_id: requestId, p_visita_id: visitaId,
    p_incluir_historico: true, p_limite: 10, p_apos_id: requestId });
});

it("busca OS elegíveis com Cliente, Visita e cursor", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: visitaId, numero: "OS-1", titulo: "Inspeção", categoria: "preventiva", status: "aberta" }], error: null });
  const resultado = await supabaseVisitasAdapter.selecionarOs({ clienteId: requestId, visitaId, busca: "OS-1", limite: 20, apos: null });
  expect(resultado).toEqual([{ id: visitaId, numero: "OS-1", titulo: "Inspeção", categoria: "preventiva", status: "aberta" }]);
  expect(api.rpc).toHaveBeenCalledWith("sso_selecionar_os_visita", { p_cliente_id: requestId, p_visita_id: visitaId,
    p_busca: "OS-1", p_limite: 20, p_apos: null });
});

it("busca funcionários ativos omitindo membros já vinculados", async () => {
  api.rpc.mockResolvedValueOnce({ data: [{ id: visitaId, nome: "Ana" }], error: null });
  const resultado = await supabaseVisitasAdapter.selecionarFuncionarios({ clienteId: requestId, visitaId, excluirVinculados: true,
    busca: "Ana", limite: 20, apos: requestId });
  expect(resultado).toEqual([{ id: visitaId, nome: "Ana" }]);
  expect(api.rpc).toHaveBeenCalledWith("sso_selecionar_funcionarios_visita", { p_cliente_id: requestId, p_visita_id: visitaId,
    p_excluir_vinculados: true, p_busca: "Ana", p_limite: 20, p_apos: requestId });
});
