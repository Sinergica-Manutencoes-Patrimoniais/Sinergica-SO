type Identidade={usuario:string};
type Referencia={objetoId:string;digest:string};
type Dependencias={habilitado:()=>Promise<boolean>;autenticar:(req:Request)=>Promise<Identidade>;limitar:(identidade:Identidade)=>Promise<boolean>;resolver:(identidade:Identidade,fotoId:string)=>Promise<Referencia|null>;baixar:(objetoId:string)=>Promise<Uint8Array>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function criarLeitura(d:Dependencias){return async(req:Request):Promise<Response>=>{
  const erro=(status:number)=>new Response(JSON.stringify({title:"Foto indisponível",status}),{status,headers:{"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  if(req.method!=="POST")return erro(405);let identidade:Identidade;try{identidade=await d.autenticar(req);}catch{return erro(401);}
  try{
    if(!await d.habilitado())return erro(503);if(!await d.limitar(identidade))return erro(429);const fotoId=req.headers.get("x-foto-id") ?? "";if(!uuid.test(fotoId))return erro(422);
    const referencia=await d.resolver(identidade,fotoId);if(!referencia)return erro(404);
    if(!referencia.objetoId||!/^[a-f0-9]{64}$/.test(referencia.digest))return erro(503);
    const bytes=await d.baixar(referencia.objetoId);if(bytes.length>10485760)return erro(413);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",Uint8Array.from(bytes).buffer)),n=>n.toString(16).padStart(2,"0")).join("");
    if(hash!==referencia.digest)return erro(409);
    const atual=await d.resolver(identidade,fotoId);if(!atual||atual.objetoId!==referencia.objetoId||atual.digest!==referencia.digest)return erro(404);
    const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);if(!jpeg&&!png)return erro(415);
    return new Response(Uint8Array.from(bytes).buffer,{headers:{"Content-Type":jpeg?"image/jpeg":"image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
  }catch{return erro(503);}
};}
