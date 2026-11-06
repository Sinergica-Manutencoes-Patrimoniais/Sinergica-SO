import type { ResultadoLoteT24 } from "./lote-t24.ts";

type Entrada={limite:number;prazoMs:number;paginas:number;itensPorPagina:number};
type Dependencias={autorizar:(req:Request)=>Promise<boolean>;executar:(entrada:Entrada)=>Promise<ResultadoLoteT24>};
const resposta=(status:number,valor:unknown)=>new Response(JSON.stringify(valor),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
class LeituraInterrompida extends Error {}
async function lerCorpo(req:Request):Promise<unknown>{
  const declarado=req.headers.get("content-length");
  if(declarado!==null&&(!/^\d+$/.test(declarado)||Number(declarado)>4096))throw new Error("Corpo inválido.");
  if(!req.body)throw new Error("Corpo ausente.");
  const leitor=req.body.getReader();const partes:Uint8Array[]=[];let total=0;
  let interromper!:()=>void;
  const interrupcao=new Promise<never>((_,reject)=>{interromper=()=>reject(new LeituraInterrompida());});
  const prazo=setTimeout(interromper,10_000);
  req.signal.addEventListener("abort",interromper,{once:true});
  let concluido=false;
  try{
    if(req.signal.aborted)throw new LeituraInterrompida();
    while(true){
      const parte=await Promise.race([leitor.read(),interrupcao]);
      if(parte.done){concluido=true;break;}
      total+=parte.value.byteLength;
      if(total>4096)throw new Error("Corpo excede limite.");
      partes.push(parte.value);
    }
  }finally{
    clearTimeout(prazo);
    req.signal.removeEventListener("abort",interromper);
    // Um stream pode não concluir cancelamento; não esperar por ele.
    if(!concluido)void leitor.cancel().catch(()=>{});
    // A leitura ainda pode estar em voo quando o cancelamento é assíncrono.
    // Não trocar a resposta de interrupção por erro de liberação do stream.
    try { leitor.releaseLock(); } catch { /* Cancelamento pode continuar em voo. */ }
  }
  const bytes=new Uint8Array(total);let posicao=0;for(const parte of partes){bytes.set(parte,posicao);posicao+=parte.length;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
function validar(valor:unknown):Entrada|null{
  if(!valor||typeof valor!=="object"||Array.isArray(valor))return null;
  const o=valor as Record<string,unknown>;if(Object.keys(o).sort().join(",")!=="itensPorPagina,limite,paginas,prazoMs")return null;
  const numero=(v:unknown,min:number,max:number):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=min&&v<=max;
  if(!numero(o.limite,1,20)||!numero(o.prazoMs,1000,60000)||!numero(o.paginas,1,100)||!numero(o.itensPorPagina,1,100))return null;
  return {limite:o.limite,prazoMs:o.prazoMs,paginas:o.paginas,itensPorPagina:o.itensPorPagina};
}
/** O consumidor precisa registrar e prover autenticador e execução confiáveis. */
export function criarHandlerT24(d:Dependencias):(req:Request)=>Promise<Response>{
  return async(req)=>{
    if(req.method!=="POST")return resposta(405,{erro:"metodo_nao_permitido"});
    try{if(await d.autorizar(req)!==true)return resposta(403,{erro:"nao_autorizado"});}catch{return resposta(403,{erro:"nao_autorizado"});}
    let entrada:Entrada|null;try{entrada=validar(await lerCorpo(req));}catch(erro){return erro instanceof LeituraInterrompida?resposta(408,{erro:"leitura_interrompida"}):resposta(400,{erro:"corpo_invalido"});}
    if(!entrada)return resposta(422,{erro:"parametros_invalidos"});
    try{
      const resultado=await d.executar(entrada);
      // Um lote pode ter realizado parte do trabalho antes de falhar; nunca prometer rollback.
      const status=resultado.parada==="erro"||resultado.parada==="incerto"?503:200;
      return resposta(status,resultado);
    }catch{return resposta(503,{erro:"processamento_nao_confirmado"});}
  };
}
