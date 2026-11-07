type Identidade={usuario:string};
type Pedido={requestId:string;loteId:string;chave:string};
type Transporte={autenticar:(req:Request)=>Promise<Identidade>;habilitado:()=>Promise<boolean>;limitar:(identidade:Identidade)=>Promise<boolean>;
  rpc:(operacao:string,args:Record<string,unknown>)=>Promise<unknown>;
  upload:(nome:string,bytes:Uint8Array,tipo:string,upsert:boolean)=>Promise<{id:string;path:string}>;
  download:(nome:string)=>Promise<Uint8Array>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function criarAdaptador(t:Transporte){
 const caminhos=new Map<string,string>();
 const args=(i:Identidade,p:Pedido,digest:string|null,objeto:string|null)=>({p_usuario_id:i.usuario,p_request_id:p.requestId||null,p_lote_id:p.loteId,p_chave:p.chave,p_digest:digest,p_objeto_id:objeto});
 return {habilitado:t.habilitado,autenticar:t.autenticar,limitar:t.limitar,
  autorizar:async(i:Identidade,loteId:string,chave:string)=>await t.rpc("autorizar",args(i,{requestId:"",loteId,chave},null,null))===true,
  reservar:async(i:Identidade,p:Pedido,digest:string)=>{const v=await t.rpc("reservar",args(i,p,digest,null));
   if(!v||typeof v!=="object"||!("estado" in v)||!("digest" in v)||typeof v.digest!=="string"||(v.estado!=="nova"&&v.estado!=="pendente"&&v.estado!=="concluida"))throw new Error("reserva_invalida");
   const r=v as {estado:"nova"|"pendente"|"concluida";digest:string;nome?:unknown;fotoId?:unknown};
   return {estado:r.estado,digest:r.digest,nome:typeof r.nome==="string"?r.nome:undefined,fotoId:typeof r.fotoId==="string"?r.fotoId:undefined};},
  recuperar:async(i:Identidade,p:Pedido,digest:string)=>{const v=await t.rpc("recuperar",args(i,p,digest,null));if(v===null)return null;
   if(!v||typeof v!=="object"||!("objetoId" in v)||!("nome" in v)||typeof v.objetoId!=="string"||!uuid.test(v.objetoId)||typeof v.nome!=="string"||!v.nome)throw new Error("objeto_invalido");
   caminhos.set(v.objetoId,v.nome);return {objetoId:v.objetoId,nome:v.nome};},
  observarPendencia:async(i:Identidade,p:Pedido,digest:string)=>{const v=await t.rpc("observar",args(i,p,digest,null));if(!v||typeof v!=="object"||!("registrado" in v)||v.registrado!==true)throw new Error("observacao_indisponivel");},
  subirNovo:async(bytes:Uint8Array,tipo:string,nome:string)=>{const v=await t.upload(nome,bytes,tipo,false);if(!uuid.test(v.id)||v.path!==nome)throw new Error("objeto_invalido");caminhos.set(v.id,nome);return {objetoId:v.id};},
  lerObjeto:async(id:string)=>{const nome=caminhos.get(id);if(!nome)throw new Error("objeto_invalido");return await t.download(nome);},
  confirmar:async(i:Identidade,p:Pedido,digest:string,id:string)=>{if(!caminhos.has(id))throw new Error("objeto_invalido");const v=await t.rpc("confirmar",args(i,p,digest,id));if(!v||typeof v!=="object"||!("fotoId" in v)||typeof v.fotoId!=="string")throw new Error("confirmacao_invalida");return {fotoId:v.fotoId};},
 };
}
