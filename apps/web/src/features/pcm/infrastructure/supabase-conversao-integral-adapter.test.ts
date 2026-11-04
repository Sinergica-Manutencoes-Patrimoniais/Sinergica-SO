import { beforeEach, expect, it, vi } from "vitest";
import type { CriarOrdemServicoCommand } from "../application/ordem-servico-gateway";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: mocks.rpc }), auth: { getUser: async () => ({ data: { user: { id: "16797005-0000-4000-8000-000000000005" } }, error: null }) } } }));
import { converterChamadoIntegral, listarComponentesConversao } from "./supabase-conversao-integral-adapter";

const ids = { requestId: "16797005-0000-4000-8000-000000000001", osId: "16797005-0000-4000-8000-000000000002", clienteId: "16797005-0000-4000-8000-000000000003", chamadoId: "16797005-0000-4000-8000-000000000004", ator: "16797005-0000-4000-8000-000000000005" };
const abertura: CriarOrdemServicoCommand = { clientId: ids.clienteId, chamadoId: ids.chamadoId, createdBy: ids.ator, titulo: "Título", descricao: "Descrição", categoria: "corretiva", prioridade: "alta", gravidade: 4, urgencia: 3, tendencia: 2, dorCliente: 1, observacao: "observação", localDescricao: "local", solicitante: "solicitante", origem: "manual", tecnicoId: null, tipoTarefaId: null, dataPrevista: null, tipoOs: "C2", pmocScheduleId: null, origemInspecaoItemId: null, equipamentoId: null, fotoUrls: ["foto"] };
const pedido = { ...ids, expectedRevision: 1, abertura, destino: "convertido_os" as const, statusHub: "corretiva" as const };
beforeEach(() => mocks.rpc.mockReset());
it("consulta Componentes pela mediação com Cliente, Chamado e cursor", async () => {
  mocks.rpc.mockResolvedValueOnce({data:[{id:ids.requestId,nome:"Bomba"}],error:null}).mockResolvedValueOnce({data:[],error:null});
  await expect(listarComponentesConversao(ids.clienteId,ids.chamadoId)).resolves.toEqual([{id:ids.requestId,nome:"Bomba"}]);
  expect(mocks.rpc).toHaveBeenNthCalledWith(1,"sso_listar_componentes_conversao",{p_cliente_id:ids.clienteId,p_chamado_id:ids.chamadoId,p_apos:null,p_limite:100});
  expect(mocks.rpc).toHaveBeenNthCalledWith(2,"sso_listar_componentes_conversao",{p_cliente_id:ids.clienteId,p_chamado_id:ids.chamadoId,p_apos:ids.requestId,p_limite:100});
});
it("envia integralmente campos e identidade estável ao wrapper", async () => {
  mocks.rpc.mockResolvedValue({ data: { requestId: ids.requestId, osId: ids.osId, chamadoId: ids.chamadoId, numero: "CH-1-OS-id", revision: 2 }, error: null });
  await expect(converterChamadoIntegral(pedido)).resolves.toMatchObject({ osId: ids.osId });
  expect(mocks.rpc).toHaveBeenCalledWith("sso_converter_chamado_integral_autorizado", expect.objectContaining({ p_request_id: ids.requestId, p_os_id: ids.osId, p_cliente_id: ids.clienteId, p_chamado_id: ids.chamadoId, p_destino: "convertido_os", p_status_hub: "corretiva", p_campos: { titulo: "Título", descricao: "Descrição", categoria: "corretiva", prioridade: "alta", gravidade: 4, urgencia: 3, tendencia: 2, dor_cliente: 1, observacao: "observação", local_descricao: "local", solicitante: "solicitante", origem: "manual", tipo_tarefa_id: null, tecnico_funcionario_id: null, data_agendada: null, tipo_os: "C2", pmoc_schedule_id: null, origem_inspecao_item_id: null, equipamento_id: null, foto_urls: ["foto"] } }));
});
it("rejeita resposta de outra OS e não tenta nova criação", async () => {
  mocks.rpc.mockResolvedValue({ data: { requestId: ids.requestId, osId: ids.chamadoId, chamadoId: ids.chamadoId, numero: "CH-1", revision: 2 }, error: null });
  await expect(converterChamadoIntegral(pedido)).rejects.toThrow(/resposta divergente/i);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it("rejeita cliente divergente antes de chamar o servidor", async () => {
  await expect(converterChamadoIntegral({ ...pedido, abertura: { ...abertura, clientId: ids.chamadoId } })).rejects.toThrow("Cliente ou Chamado divergente");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("serializa todas as chaves com null explícito em abertura mínima real", async () => {
  const { equipamentoId: _equipamento, fotoUrls: _fotos, ...minimo } = abertura;
  mocks.rpc.mockResolvedValue({ data: { requestId: ids.requestId, osId: ids.osId, chamadoId: ids.chamadoId, numero: "CH-1-OS-id", revision: 2 }, error: null });
  await converterChamadoIntegral({ ...pedido, abertura: minimo });
  const chamada = mocks.rpc.mock.calls[0];
  expect(chamada).toBeDefined();
  const serializado = JSON.parse(JSON.stringify(chamada?.[1]));
  expect(Object.keys(serializado.p_campos)).toHaveLength(20);
  expect(serializado.p_campos).toMatchObject({ equipamento_id: null, foto_urls: [], pmoc_schedule_id: null, origem_inspecao_item_id: null, tipo_tarefa_id: null, tecnico_funcionario_id: null, data_agendada: null });
});
