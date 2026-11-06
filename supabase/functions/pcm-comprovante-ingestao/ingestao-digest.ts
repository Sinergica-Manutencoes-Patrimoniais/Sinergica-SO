// Preparação isolada ADR-0806: não implantada, sem persistência/Storage conectados.
type Identidade = { usuario: string };
type Pedido = { requestId: string; despesaId: string };
type Reserva = { estado: "nova" | "pendente" | "concluida" | "recuperavel"; digest: string; clienteId?: string; caminho?: string; objetoId?: string };
export class ConflitoRequest extends Error {}
export class PrazoExcedido extends Error {}
class LeituraExpirada extends Error {}
class LeituraCancelada extends Error {}
export type Dependencias = {
  autenticar: (req: Request) => Promise<Identidade>;
  habilitado: () => Promise<boolean>;
  limitar: (i: Identidade) => Promise<boolean>;
  autorizar: (i: Identidade, despesaId: string) => Promise<boolean>;
  reservar: (i: Identidade, p: Pedido, digest: string) => Promise<Reserva>;
  recuperarPendente?: (i: Identidade, p: Pedido, digest: string) => Promise<Reserva>;
  subirNovo: (bytes: Uint8Array, tipo: string, caminho: string) => Promise<{ objetoId: string }>;
  baixar: (objetoId: string) => Promise<Uint8Array>;
  confirmar: (i: Identidade, p: Pedido, digest: string, objetoId: string) => Promise<{ objetoId: string }>;
  /** Prazo total de leitura, somente reduzível para testes; não altera operações após a leitura. */
  prazoLeituraMs?: number;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function hash(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer)), n=>n.toString(16).padStart(2,"0")).join(""); }
export function criarIngestaoDigest(d: Dependencias) { return async (req: Request): Promise<Response> => {
  const erro=(status:number)=>new Response(JSON.stringify({title:"Ingestão indisponível",status}),{status,headers:{"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  if(req.method!=="POST")return erro(405);
  let i: Identidade; try{i=await d.autenticar(req);}catch(e){return erro(e instanceof PrazoExcedido ? 503 : 401);}
  try {
    if(!await d.habilitado())return erro(503);
    if(!await d.limitar(i))return erro(429);
    const p={requestId:req.headers.get("x-request-id")??"",despesaId:req.headers.get("x-despesa-id")??""};
    if(!uuid.test(i.usuario)||!uuid.test(p.requestId)||!uuid.test(p.despesaId)||!req.body)return erro(422);
    const tamanho=req.headers.get("content-length");
    if(tamanho!==null&&(!/^\d+$/.test(tamanho)||BigInt(tamanho)>10485760n))return erro(413);
    if(!await d.autorizar(i,p.despesaId))return erro(404);
    const reader=req.body.getReader(), partes:Uint8Array[]=[];let total=0;
    const prazo=Number.isSafeInteger(d.prazoLeituraMs)&&d.prazoLeituraMs!>0 ? Math.min(d.prazoLeituraMs!,30000) : 30000;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const expiracao=new Promise<never>((_,rejeitar)=>{temporizador=setTimeout(()=>rejeitar(new LeituraExpirada()),prazo);});
    let cancelar!:()=>void;
    const interrupcao=new Promise<never>((_,rejeitar)=>{cancelar=()=>rejeitar(new LeituraCancelada());});
    req.signal.addEventListener("abort",cancelar,{once:true});
    try {
      if(req.signal.aborted)throw new LeituraCancelada();
      for(;;){const {done,value}=await Promise.race([reader.read(),expiracao,interrupcao]);if(done)break;total+=value.byteLength;if(total>10485760){void reader.cancel().catch(()=>{});return erro(413);}partes.push(value);}
    } catch(e) { void reader.cancel().catch(()=>{}); throw e; }
    finally { if(temporizador!==undefined)clearTimeout(temporizador);req.signal.removeEventListener("abort",cancelar);try{reader.releaseLock();}catch{/* A leitura pode continuar em voo. */} }
    const bytes=new Uint8Array(total);let pos=0;for(const parte of partes){bytes.set(parte,pos);pos+=parte.length;}
    const pdf=bytes.length>=5&&[37,80,68,70,45].every((n,j)=>bytes[j]===n);
    const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,j)=>bytes[j]===n);
    if(!pdf&&!jpeg&&!png)return erro(415);
    const digest=await hash(bytes);
    if(req.signal.aborted)throw new LeituraCancelada();
    let reserva=await d.reservar(i,p,digest);
    if(reserva.digest!==digest)return erro(409);
    if(reserva.estado==="pendente"){
      if(!d.recuperarPendente)return erro(409);
      reserva=await d.recuperarPendente(i,p,digest);
      if(reserva.digest!==digest||reserva.estado==="pendente"||reserva.estado==="nova")return erro(409);
    }
    if(req.signal.aborted)throw new LeituraCancelada();
    const partesCaminho=reserva.caminho?.split("/")??[];
    if(!reserva.clienteId||!uuid.test(reserva.clienteId)||partesCaminho.length!==3||!partesCaminho.every(x=>uuid.test(x))||partesCaminho[0]?.toLowerCase()!==reserva.clienteId.toLowerCase()||partesCaminho[1]?.toLowerCase()!==p.despesaId.toLowerCase()||partesCaminho[2]?.toLowerCase()!==p.requestId.toLowerCase())return erro(503);
    if(reserva.estado==="concluida"||reserva.estado==="recuperavel"){
      if(!reserva.objetoId||!uuid.test(reserva.objetoId))return erro(503);
      const armazenado=await d.baixar(reserva.objetoId);if(armazenado.length>10485760)return erro(413);
      if(await hash(armazenado)!==digest)return erro(409);
      if(!await d.autorizar(i,p.despesaId))return erro(404);
      if(req.signal.aborted)throw new LeituraCancelada();
      if(reserva.estado==="recuperavel" && (await d.confirmar(i,p,digest,reserva.objetoId)).objetoId!==reserva.objetoId)return erro(503);
      return new Response(JSON.stringify({requestId:p.requestId,objetoId:reserva.objetoId}),{headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}});
    }
    if(reserva.estado!=="nova")return erro(503);
    if(req.signal.aborted)throw new LeituraCancelada();
    const arquivo=await d.subirNovo(bytes,pdf?"application/pdf":jpeg?"image/jpeg":"image/png",reserva.caminho!);
    if(!uuid.test(arquivo.objetoId))return erro(503);
    const armazenado=await d.baixar(arquivo.objetoId);if(armazenado.length>10485760)return erro(413);
    if(await hash(armazenado)!==digest)return erro(409);
    if(!await d.autorizar(i,p.despesaId))return erro(404);
    if(req.signal.aborted)throw new LeituraCancelada();
    if((await d.confirmar(i,p,digest,arquivo.objetoId)).objetoId!==arquivo.objetoId)return erro(503);
    return new Response(JSON.stringify({requestId:p.requestId,objetoId:arquivo.objetoId}),{headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}});
  }catch(e){return erro(e instanceof ConflitoRequest ? 409 : e instanceof LeituraExpirada || e instanceof LeituraCancelada ? 408 : 503);}
};}
