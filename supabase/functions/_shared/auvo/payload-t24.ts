import type { ConcessaoT24 } from "./orquestracao-t24.ts";
import { utcParaHorarioAuvo } from "./horario-t24.ts";

export type ContratoPayloadT24 = {
  comprovado: boolean;
  fuso: string;
  campoTipo: "taskType" | "taskTypeId";
  campoAlvo: "equipmentId" | "equipmentsId";
  prioridades: Readonly<Record<string, number>>;
  limiteOrientacao: number;
  permiteAtualizarCamposCriticos: boolean;
  questionarioAusenteSeguroNaAtualizacao: boolean;
};
type Resultado = {ok:false;motivo:string} | {ok:true;criacao:Record<string,unknown>;atualizacao:Record<string,unknown>};
const idNumero=(valor:unknown):number|null=>{
  if(typeof valor!=="string"||!/^[1-9]\d*$/.test(valor))return null;
  const numero=Number(valor);return Number.isSafeInteger(numero)&&numero>0?numero:null;
};

/** Não comprova contrato nem envia rede; consumidor deve obter contrato de fonte confiável. */
export function montarPayloadT24(c:ConcessaoT24,contrato:ContratoPayloadT24):Resultado {
  if(!contrato||contrato.comprovado!==true)return {ok:false,motivo:"contrato_nao_comprovado"};
  if(!(contrato.campoTipo==="taskType"||contrato.campoTipo==="taskTypeId")||!(contrato.campoAlvo==="equipmentId"||contrato.campoAlvo==="equipmentsId")||
    !Number.isSafeInteger(contrato.limiteOrientacao)||contrato.limiteOrientacao<1||contrato.limiteOrientacao>16000)return {ok:false,motivo:"contrato_invalido"};
  if(!c||!c.despacho||!c.esperado||typeof c.osId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.osId))return {ok:false,motivo:"origem_invalida"};
  if(typeof c.questionarioObrigatorio!=="boolean"||!(c.operacao==="criar"||c.operacao==="atualizar"))return {ok:false,motivo:"origem_invalida"};
  if(c.operacao==="atualizar"&&(contrato.permiteAtualizarCamposCriticos!==true||(c.esperado.questionarioId===null&&contrato.questionarioAusenteSeguroNaAtualizacao!==true)))return {ok:false,motivo:"atualizacao_nao_comprovada"};
  const cliente=idNumero(c.despacho.clienteAuvoId),tipo=idNumero(c.despacho.tipoTarefaAuvoId),tecnico=idNumero(c.esperado.tecnicoId),alvo=idNumero(c.esperado.alvoId);
  const questionario=c.esperado.questionarioId===null?null:idNumero(c.esperado.questionarioId);
  if(cliente===null||tipo===null||tecnico===null||alvo===null||(c.esperado.questionarioId!==null&&questionario===null)||(c.questionarioObrigatorio&&questionario===null))return {ok:false,motivo:"vinculo_invalido"};
  const prioridade=contrato.prioridades?.[c.despacho.prioridade];
  if(typeof prioridade!=="number"||!Number.isSafeInteger(prioridade)||prioridade<1)return {ok:false,motivo:"prioridade_nao_mapeada"};
  const horario=utcParaHorarioAuvo(c.esperado.inicio,contrato.fuso);if(!horario.ok)return {ok:false,motivo:`horario_${horario.motivo}`};
  if(typeof c.despacho.titulo!=="string"||!c.despacho.titulo.trim()||!(c.despacho.descricao===null||typeof c.despacho.descricao==="string"))return {ok:false,motivo:"orientacao_invalida"};
  const orientacao=c.despacho.descricao?.trim()?c.despacho.descricao:c.despacho.titulo;
  if(orientacao.length>contrato.limiteOrientacao)return {ok:false,motivo:"orientacao_excede_limite"};
  const campos:Record<string,unknown>={idUserTo:tecnico,taskDate:horario.valor,[contrato.campoAlvo]:contrato.campoAlvo==="equipmentsId"?[alvo]:alvo};
  if(questionario!==null)campos.questionnaireId=questionario;
  return {ok:true,criacao:{externalId:c.osId,customerId:cliente,[contrato.campoTipo]:tipo,priority:prioridade,orientation:orientacao,...campos},atualizacao:campos};
}
