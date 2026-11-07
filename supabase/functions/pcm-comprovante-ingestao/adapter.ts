import type { Dependencias } from "./ingestao-digest.ts";
type Operacao = "autorizar" | "reservar" | "confirmar" | "recuperar";
type Args = { p_usuario_id:string; p_despesa_id:string; p_request_id:string|null; p_digest:string|null; p_objeto_id:string|null };
type Porta = { rpc:(operacao:Operacao,args:Args)=>Promise<unknown>; upload:(caminho:string,bytes:Uint8Array,tipo:string,upsert:false)=>Promise<{id:string;path:string}>; download:(caminho:string)=>Promise<Uint8Array> };
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function criarAdaptador(porta:Porta):Pick<Dependencias,"autorizar"|"reservar"|"recuperarPendente"|"subirNovo"|"baixar"|"confirmar"> {
  // Escopo de uma requisição: não recuperar objetos de requisições anteriores por ID.
  const caminhos=new Map<string,string>();
  return {
    autorizar:async(i,despesaId)=>await porta.rpc("autorizar",{p_usuario_id:i.usuario,p_despesa_id:despesaId,p_request_id:null,p_digest:null,p_objeto_id:null})===true,
    reservar:async(i,p,digest)=>{
      const r=await porta.rpc("reservar",{p_usuario_id:i.usuario,p_despesa_id:p.despesaId,p_request_id:p.requestId,p_digest:digest,p_objeto_id:null});
      if(!r||typeof r!=="object")throw new Error("reserva_invalida");
      const x=r as Record<string,unknown>;
      if((x.estado!=="nova"&&x.estado!=="pendente"&&x.estado!=="concluida")||x.digest!==digest)throw new Error("reserva_invalida");
      if(x.estado!=="pendente"){
        if(typeof x.clienteId!=="string"||!uuid.test(x.clienteId)||typeof x.caminho!=="string"||x.caminho.toLowerCase()!==`${x.clienteId}/${p.despesaId}/${p.requestId}`.toLowerCase())throw new Error("reserva_invalida");
        if(x.estado==="concluida") { if(typeof x.objetoId!=="string"||!uuid.test(x.objetoId))throw new Error("reserva_invalida"); caminhos.set(x.objetoId,x.caminho); }
      }
      return {estado:x.estado,digest,clienteId:typeof x.clienteId==="string"?x.clienteId:undefined,caminho:typeof x.caminho==="string"?x.caminho:undefined,objetoId:typeof x.objetoId==="string"?x.objetoId:undefined};
    },
    recuperarPendente:async(i,p,digest)=>{
      const r=await porta.rpc("recuperar",{p_usuario_id:i.usuario,p_despesa_id:p.despesaId,p_request_id:p.requestId,p_digest:digest,p_objeto_id:null});
      if(!r||typeof r!=="object")throw new Error("recuperacao_invalida");
      const x=r as Record<string,unknown>;
      if((x.estado!=="pendente"&&x.estado!=="recuperavel"&&x.estado!=="concluida")||x.digest!==digest||typeof x.clienteId!=="string"||!uuid.test(x.clienteId)||typeof x.caminho!=="string"||x.caminho.toLowerCase()!==`${x.clienteId}/${p.despesaId}/${p.requestId}`.toLowerCase())throw new Error("recuperacao_invalida");
      if(x.estado!=="pendente"){
        if(typeof x.objetoId!=="string"||!uuid.test(x.objetoId))throw new Error("recuperacao_invalida");
        caminhos.set(x.objetoId,x.caminho);
      }
      return {estado:x.estado,digest,clienteId:x.clienteId,caminho:x.caminho,objetoId:typeof x.objetoId==="string"?x.objetoId:undefined};
    },
    subirNovo:async(bytes,tipo,caminho)=>{const r=await porta.upload(caminho,bytes,tipo,false);if(!uuid.test(r.id)||r.path!==caminho)throw new Error("upload_divergente");caminhos.set(r.id,caminho);return {objetoId:r.id};},
    baixar:async(id)=>{const caminho=caminhos.get(id);if(!caminho)throw new Error("objeto_desconhecido");return await porta.download(caminho);},
    confirmar:async(i,p,digest,objetoId)=>{if(!caminhos.has(objetoId))throw new Error("objeto_desconhecido");const r=await porta.rpc("confirmar",{p_usuario_id:i.usuario,p_despesa_id:p.despesaId,p_request_id:p.requestId,p_digest:digest,p_objeto_id:objetoId});if(!r||typeof r!=="object"||(r as Record<string,unknown>).objetoId!==objetoId)throw new Error("confirmacao_divergente");return {objetoId};},
  };
}
