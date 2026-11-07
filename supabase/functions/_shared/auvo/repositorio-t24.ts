import type { CamposCriticosOperacionais } from "./contrato-operacional.ts";
import type { ConcessaoT24, RepositorioT24 } from "./orquestracao-t24.ts";

/** Porta interna injetada. A implementação é responsável por autenticação de serviço. */
export type RpcT24 = (nome: string, parametros: Record<string, unknown>) => Promise<unknown>;

const id = (valor: unknown): valor is string => typeof valor === "string" && valor.length > 0 && valor.length <= 200 && valor.trim() === valor;
const registro = (valor: unknown): valor is Record<string, unknown> => !!valor && typeof valor === "object" && !Array.isArray(valor);

/** Não registra rota, agenda trabalho ou fornece acesso à rede. Uma instância atende um fluxo. */
export function criarRepositorioT24(rpc: RpcT24): RepositorioT24 {
  const pedidos = new Map<string, string>();
  const pedido = (chave: string) => { let valor=pedidos.get(chave); if(!valor){valor=crypto.randomUUID();pedidos.set(chave,valor);}return valor; };
  const chave = (c: ConcessaoT24) => `${c.tentativaId}:${c.fence}`;
  return {
    async conceder() {
      const valor=await rpc("sso_t24_reservar_candidata",{p_duracao_segundos:120});
      if(valor===null)return null;
      if(!registro(valor)||!id(valor.tentativaId)||!id(valor.osId)||!id(valor.visitaId)||!Number.isSafeInteger(valor.fence)||Number(valor.fence)<1||
        !Number.isSafeInteger(valor.revisao)||Number(valor.revisao)<1||!(valor.operacao==="criar"||valor.operacao==="atualizar")||
        !(valor.tarefaId===null||id(valor.tarefaId))||!registro(valor.esperado)||!registro(valor.despacho)||typeof valor.questionarioObrigatorio!=="boolean"||valor.autorizaEnvio!==false)
        throw new Error("Reserva T24 inválida.");
      const e=valor.esperado;
      if(!id(e.tecnicoId)||!id(e.inicio)||!id(e.alvoId)||!(e.questionarioId===null||id(e.questionarioId)))throw new Error("Campos T24 inválidos.");
      const d=valor.despacho;
      if(!id(d.clienteId)||!id(d.clienteAuvoId)||!id(d.tipoTarefaId)||!id(d.tipoTarefaAuvoId)||typeof d.titulo!=="string"||!d.titulo.trim()||!(d.descricao===null||typeof d.descricao==="string")||!id(d.prioridade))throw new Error("Contexto T24 inválido.");
      return {tentativaId:valor.tentativaId,osId:valor.osId,visitaId:valor.visitaId,fence:Number(valor.fence),revisao:Number(valor.revisao),operacao:valor.operacao,
        tarefaId:valor.tarefaId,esperado:{tecnicoId:e.tecnicoId,inicio:e.inicio,alvoId:e.alvoId,questionarioId:e.questionarioId},despacho:{clienteId:d.clienteId,clienteAuvoId:d.clienteAuvoId,tipoTarefaId:d.tipoTarefaId,tipoTarefaAuvoId:d.tipoTarefaAuvoId,titulo:d.titulo,descricao:d.descricao,prioridade:d.prioridade},questionarioObrigatorio:valor.questionarioObrigatorio};
    },
    async iniciarEfeito(c) {
      const requestId=pedido(`inicio:${chave(c)}`);
      const valor=await rpc("sso_t24_iniciar_efeito",{p_request_id:requestId,p_tentativa_id:c.tentativaId,p_fence:c.fence});
      if(!registro(valor)||valor.requestId!==requestId||valor.tentativaId!==c.tentativaId||valor.fence!==c.fence||typeof valor.autorizaEnvio!=="boolean"||typeof valor.resultadoIncerto!=="boolean")
        throw new Error("Recibo de início inválido.");
      if(valor.autorizaEnvio===true && valor.resultadoIncerto===false)return "autorizado";
      if(valor.autorizaEnvio===false && valor.resultadoIncerto===true)return "incerto";
      if(valor.autorizaEnvio===false && valor.resultadoIncerto===false)return "bloqueado";
      throw new Error("Recibo de início contraditório.");
    },
    async registrarTardia(c,tarefaId,motivo) {
      const requestId=pedido(`tardia:${chave(c)}:${motivo}`);
      const valor=await rpc("sso_t24_registrar_resposta_tardia",{p_request_id:requestId,p_tentativa_id:c.tentativaId,p_fence:c.fence,p_tarefa_observada:tarefaId,p_motivo:motivo});
      if(!registro(valor)||valor.requestId!==requestId||valor.tentativaId!==c.tentativaId||valor.fenceObservado!==c.fence||valor.efeitoRemotoComprovado!==false)throw new Error("Recibo tardio inválido.");
    },
    async registrar(c,estado,tarefaId,motivo,observado?:CamposCriticosOperacionais) {
      const requestId=pedido(`resultado:${chave(c)}:${estado}:${motivo}`);
      try {
        const valor=estado==="confirmado"
          ? await rpc("sso_t24_confirmar_efeito",{p_request_id:requestId,p_tentativa_id:c.tentativaId,p_fence:c.fence,p_tarefa_id:tarefaId,p_observado:observado})
          : await rpc("sso_t24_resultado_outbox_servico",{p_request_id:requestId,p_tentativa_id:c.tentativaId,p_fence:c.fence,p_estado:estado,p_tarefa_observada:tarefaId,p_motivo:motivo});
        if(!registro(valor)||valor.requestId!==requestId||valor.tentativaId!==c.tentativaId||valor.fence!==c.fence||valor.estado!==estado)return false;
        return estado!=="confirmado" || (valor.tarefaId===tarefaId && !!observado);
      } catch {
        // O banco só aceita observação se existir evento de início no fence antigo.
        if(estado!=="bloqueado") {
          try { await rpc("sso_t24_registrar_resposta_tardia",{p_request_id:pedido(`tardia:${chave(c)}:${estado}:${motivo}`),p_tentativa_id:c.tentativaId,p_fence:c.fence,p_tarefa_observada:tarefaId,p_motivo:motivo}); } catch { /* permanece incerto */ }
        }
        return false;
      }
    },
  };
}
