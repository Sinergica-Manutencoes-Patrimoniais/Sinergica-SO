import { horarioAuvoParaUtc } from "./horario-t24.ts";
import { toAuvoJsonPatch, type AuvoJsonPatchOp } from "./json-patch.ts";
import type { CamposCriticosOperacionais } from "./contrato-operacional.ts";
import type { FornecedorT24 } from "./orquestracao-t24.ts";
import { montarPayloadT24, type ContratoPayloadT24 } from "./payload-t24.ts";
import { buscarIdentidadeT24, type LeitorPaginaIdentidadeT24 } from "./busca-identidade-t24.ts";

type Objeto=Record<string,unknown>;
export type ContratoLeituraT24=ContratoPayloadT24 & {
  campoId:string;campoExternalId:string;campoTecnico:string;campoHorario:string;campoAlvoLeitura:string;campoQuestionario:string;
  questionarioAusenteSignificaNenhum:boolean;
};
export type TransporteT24={
  contrato:()=>Promise<ContratoLeituraT24>;
  buscarPagina:LeitorPaginaIdentidadeT24;
  criar:(payload:Objeto)=>Promise<unknown>;
  atualizar:(id:string,patch:AuvoJsonPatchOp[])=>Promise<void>;
  ler:(id:string)=>Promise<unknown>;
};
const objeto=(x:unknown):x is Objeto=>!!x&&typeof x==="object"&&!Array.isArray(x);
const numeroId=(x:unknown):string|null=>{
  if(typeof x==="number")return Number.isSafeInteger(x)&&x>0?String(x):null;
  if(typeof x!=="string"||!/^[1-9]\d*$/.test(x))return null;
  const n=Number(x);return Number.isSafeInteger(n)&&n>0?x:null;
};
const campo=(x:unknown):x is string=>typeof x==="string"&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(x);
/** Limita a espera, não cancela nem desfaz eventual efeito remoto tardio. */
async function comPrazo<T>(acao:()=>Promise<T>):Promise<T>{
  let prazo:ReturnType<typeof setTimeout>|undefined;
  const expiracao=new Promise<never>((_resolver,rejeitar)=>{prazo=setTimeout(()=>rejeitar(new Error("Prazo remoto excedido; resultado não confirmado.")),15_000);});
  try{return await Promise.race([acao(),expiracao]);}finally{if(prazo!==undefined)clearTimeout(prazo);}
}
function validarContrato(c:ContratoLeituraT24):void {
  if(!c||c.comprovado!==true)throw new Error("Contrato de leitura não comprovado.");
  const campos=[c.campoId,c.campoExternalId,c.campoTecnico,c.campoHorario,c.campoAlvoLeitura,c.campoQuestionario];
  // Campos críticos precisam ser independentes: uma propriedade não pode
  // servir simultaneamente como prova de técnico, alvo, identidade ou data.
  if(!campos.every(campo)||new Set(campos).size!==campos.length||typeof c.questionarioAusenteSignificaNenhum!=="boolean")
    throw new Error("Contrato de leitura não comprovado.");
}
/** Cria somente portas injetadas; não registra rota, credenciais ou agendamento. */
export function criarFornecedorT24(t:TransporteT24,limites:{paginas:number;itensPorPagina:number}):FornecedorT24 {
  let fotografiaContrato:string|null=null;
  async function contratoAtual():Promise<ContratoLeituraT24>{const c=await comPrazo(()=>t.contrato());validarContrato(c);if(fotografiaContrato===null||JSON.stringify(c)!==fotografiaContrato)throw new Error("Contrato alterado ou não conferido.");return c;}
  return {
    async contratoComprovado(){try{const c=await comPrazo(()=>t.contrato());validarContrato(c);fotografiaContrato=JSON.stringify(c);return true;}catch{fotografiaContrato=null;return false;}},
    async buscarIdentidade(osId){
      const c=await contratoAtual();const r=await buscarIdentidadeT24({osId,campoExternalId:c.campoExternalId,contratoComprovado:c.comprovado,
        limitePaginas:limites.paginas,limitePagina:limites.itensPorPagina},(entrada)=>comPrazo(()=>t.buscarPagina(entrada)));
      if(!r||r.completa!==true||r.identidadeComprovada!==true||!Array.isArray(r.itens))return {completa:false,identidadeComprovada:false,candidatos:[]};
      const ids:string[]=[];
      for(const item of r.itens){if(!objeto(item)||typeof item[c.campoExternalId]!=="string"||(item[c.campoExternalId] as string).toLowerCase()!==osId.toLowerCase())return {completa:false,identidadeComprovada:false,candidatos:[]};
        const id=numeroId(item[c.campoId]);if(id===null||ids.includes(id))return {completa:false,identidadeComprovada:false,candidatos:[]};ids.push(id);}
      return {completa:true,identidadeComprovada:true,candidatos:ids};
    },
    async criar(concessao){const c=await contratoAtual();const payload=montarPayloadT24(concessao,c);if(!payload.ok)throw new Error(`Payload bloqueado: ${payload.motivo}`);
      const r=await t.criar(payload.criacao);if(!objeto(r))throw new Error("Resposta de criação inválida.");const id=numeroId(r[c.campoId]);if(id===null)throw new Error("Identidade remota ausente.");return {tarefaId:id};},
    async atualizar(concessao,id){const c=await contratoAtual();if(numeroId(id)!==id)throw new Error("Identidade remota inválida.");
      const payload=montarPayloadT24(concessao,c);if(!payload.ok)throw new Error(`Payload bloqueado: ${payload.motivo}`);await t.atualizar(id,toAuvoJsonPatch(payload.atualizacao));},
    async ler(id,osId):Promise<CamposCriticosOperacionais>{const c=await contratoAtual();if(numeroId(id)!==id||typeof osId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(osId))throw new Error("Identidade remota inválida.");
      const r=await comPrazo(()=>t.ler(id));if(!objeto(r))throw new Error("Leitura remota inválida.");const tarefaId=numeroId(r[c.campoId]),tecnicoId=numeroId(r[c.campoTecnico]);
      if(typeof r[c.campoExternalId]!=="string"||(r[c.campoExternalId] as string).toLowerCase()!==osId.toLowerCase())throw new Error("Identidade externa divergente.");
      const brutoAlvo=r[c.campoAlvoLeitura];const alvoId=Array.isArray(brutoAlvo)?(brutoAlvo.length===1?numeroId(brutoAlvo[0]):null):numeroId(brutoAlvo);
      const brutoQuestionario=r[c.campoQuestionario];const questionarioId=brutoQuestionario==null&&c.questionarioAusenteSignificaNenhum?null:numeroId(brutoQuestionario);
      if(!tarefaId||tarefaId!==id||!tecnicoId||!alvoId||(questionarioId===null&&!(brutoQuestionario==null&&c.questionarioAusenteSignificaNenhum))||typeof r[c.campoHorario]!=="string")throw new Error("Campos remotos incompletos.");
      const horario=horarioAuvoParaUtc(r[c.campoHorario] as string,c.fuso);if(!horario.ok)throw new Error(`Horário remoto inválido: ${horario.motivo}`);
      return {tarefaId,tecnicoId,alvoId,questionarioId,inicio:horario.valor};},
  };
}
