// ADR-0819: não implantar até bloquear rotas paralelas e homologar o seletor.
type Identidade={usuario:string};
type Referencia={origem:"mediado"|"legado";objetoId:string;digest:string|null};
export type Dependencias={autenticar:(r:Request)=>Promise<Identidade>;habilitado:()=>Promise<boolean>;limitar:(i:Identidade)=>Promise<boolean>;resolver:(i:Identidade,id:string)=>Promise<Referencia|null>;baixar:(id:string)=>Promise<Uint8Array>;auditar?:(i:Identidade,id:string)=>Promise<boolean>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function criarLeituraUnificada(d:Dependencias){return async(req:Request):Promise<Response>=>{
 const erro=(status:number)=>new Response(JSON.stringify({title:"Comprovante indisponível",status}),{status,headers:{"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 if(req.method!=="POST")return erro(405);let i:Identidade;try{i=await d.autenticar(req);}catch{return erro(401);}
 try{if(!await d.habilitado())return erro(503);if(!uuid.test(i.usuario))return erro(401);if(!await d.limitar(i))return erro(429);
 const despesa=req.headers.get("x-despesa-id")??"";if(!uuid.test(despesa))return erro(422);
 const r=await d.resolver(i,despesa);if(!r)return erro(404);
 if(!uuid.test(r.objetoId)||(r.origem!=="mediado"&&r.origem!=="legado")||(r.origem==="mediado"&&(typeof r.digest!=="string"||!/^[a-f0-9]{64}$/.test(r.digest)))||(r.origem==="legado"&&r.digest!==null))return erro(503);
 const original=await d.baixar(r.objetoId);if(original.length>10485760)return erro(413);const bytes=Uint8Array.from(original);
 if(r.origem==="mediado"){const h=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes.buffer)),n=>n.toString(16).padStart(2,"0")).join("");if(h!==r.digest)return erro(409);}
 const atual=await d.resolver(i,despesa);if(!atual||atual.origem!==r.origem||atual.objetoId!==r.objetoId||atual.digest!==r.digest)return erro(404);
 if(d.auditar&&!await d.auditar(i,despesa))return erro(404);
 const pdf=bytes.length>=5&&[37,80,68,70,45].every((v,j)=>bytes[j]===v),jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,j)=>bytes[j]===v);if(!pdf&&!jpeg&&!png)return erro(415);
 return new Response(bytes.buffer,{headers:{"Content-Type":pdf?"application/pdf":jpeg?"image/jpeg":"image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch{return erro(503);}
};}
