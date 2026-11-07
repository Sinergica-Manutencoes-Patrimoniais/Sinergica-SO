type Identidade={usuario:string};
type Pedido={requestId:string;loteId:string;chave:string};
type Reserva={estado:"nova"|"pendente"|"concluida";digest:string;nome?:string;fotoId?:string};
type Dependencias={
  habilitado:()=>Promise<boolean>;
  autenticar:(req:Request)=>Promise<Identidade>;
  limitar:(identidade:Identidade)=>Promise<boolean>;
  autorizar:(identidade:Identidade,loteId:string,chave:string)=>Promise<boolean>;
  reservar:(identidade:Identidade,pedido:Pedido,digest:string)=>Promise<Reserva>;
  recuperar?:(identidade:Identidade,pedido:Pedido,digest:string)=>Promise<{objetoId:string;nome:string}|null>;
  observarPendencia?:(identidade:Identidade,pedido:Pedido,digest:string)=>Promise<void>;
  subirNovo:(bytes:Uint8Array,tipo:string,nome:string)=>Promise<{objetoId:string}>;
  lerObjeto:(objetoId:string)=>Promise<Uint8Array>;
  confirmar:(identidade:Identidade,pedido:Pedido,digest:string,objetoId:string)=>Promise<{fotoId:string}>;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function digest(bytes:Uint8Array):Promise<string>{const hash=await crypto.subtle.digest("SHA-256",Uint8Array.from(bytes).buffer);return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,"0")).join("");}
export function criarHandler(d:Dependencias){return async(req:Request):Promise<Response>=>{
  const erro=(status:number)=>new Response(JSON.stringify({title:"Ingestão indisponível",status}),{status,headers:{"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  if(req.method!=="POST")return erro(405);
  let identidade:Identidade;try{identidade=await d.autenticar(req);}catch{return erro(401);}
  try{
    if(!await d.habilitado())return erro(503);
    if(!await d.limitar(identidade))return erro(429);
    const requestId=req.headers.get("x-request-id") ?? "",loteId=req.headers.get("x-lote-id") ?? "",chave=req.headers.get("x-linha-chave") ?? "";
    if(!uuid.test(requestId)||!uuid.test(loteId)||!chave.trim()||chave.length>200||!req.body)return erro(422);
    if(!await d.autorizar(identidade,loteId,chave))return erro(404);
    const leitor=req.body.getReader();const partes:Uint8Array[]=[];let total=0;
    for(;;){const {done,value}=await leitor.read();if(done)break;total+=value.byteLength;if(total>10485760){void leitor.cancel().catch(()=>{});return erro(413);}partes.push(value);}
    const bytes=new Uint8Array(total);let pos=0;for(const parte of partes){bytes.set(parte,pos);pos+=parte.length;}
    const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
    if(!jpeg&&!png)return erro(415);
    const hash=await digest(bytes),pedido={requestId,loteId,chave};const reserva=await d.reservar(identidade,pedido,hash);
    if(reserva.digest!==hash)return erro(409);
    if(reserva.estado==="concluida"){if(!reserva.fotoId||!uuid.test(reserva.fotoId)||!await d.autorizar(identidade,loteId,chave))return erro(404);return new Response(JSON.stringify({fotoId:reserva.fotoId,requestId}),{headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}});}
    if(reserva.estado==="pendente"&&!d.recuperar)return erro(409);
    const partesNome=reserva.nome?.split("/");
    if(!partesNome||partesNome.length!==3||!partesNome.every(p=>uuid.test(p))||partesNome[1]!==loteId)return erro(503);
    const objeto=reserva.estado==="pendente"?await d.recuperar!(identidade,pedido,hash):await d.subirNovo(bytes,jpeg?"image/jpeg":"image/png",reserva.nome!);
    if(!objeto){if(d.observarPendencia)await d.observarPendencia(identidade,pedido,hash);return erro(409);}
    if("nome" in objeto && objeto.nome!==reserva.nome)return erro(409);
    if(!objeto.objetoId)return erro(503);
    const armazenado=await d.lerObjeto(objeto.objetoId);
    if(await digest(armazenado)!==hash)return erro(409);
    if(!await d.autorizar(identidade,loteId,chave))return erro(404);
    const resultado=await d.confirmar(identidade,pedido,hash,objeto.objetoId);
    if(!uuid.test(resultado.fotoId))return erro(503);
    return new Response(JSON.stringify({fotoId:resultado.fotoId,requestId}),{headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}});
  }catch{return erro(503);}
};}
