type Identidade={usuario:string};
type Transporte={autenticar:(req:Request)=>Promise<Identidade>;habilitado:()=>Promise<boolean>;limitar:(identidade:Identidade)=>Promise<boolean>;resolver:(usuario:string,fotoId:string)=>Promise<unknown>;download:(nome:string)=>Promise<Uint8Array>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function criarAdaptadorLeitura(t:Transporte){
 const caminhos=new Map<string,string>();
 return {habilitado:t.habilitado,autenticar:t.autenticar,limitar:t.limitar,
  resolver:async(i:Identidade,fotoId:string)=>{const r=await t.resolver(i.usuario,fotoId);if(r===null)return null;
   if(!r||typeof r!=="object"||!("objetoId" in r)||!("nome" in r)||!("digest" in r)||typeof r.objetoId!=="string"||!uuid.test(r.objetoId)||typeof r.nome!=="string"||!r.nome||typeof r.digest!=="string"||!/^[a-f0-9]{64}$/.test(r.digest))throw new Error("referencia_invalida");
   const anterior=caminhos.get(r.objetoId);if(anterior&&anterior!==r.nome)throw new Error("referencia_alterada");caminhos.set(r.objetoId,r.nome);return {objetoId:r.objetoId,digest:r.digest};},
  baixar:async(id:string)=>{const nome=caminhos.get(id);if(!nome)throw new Error("objeto_indisponivel");return await t.download(nome);},
 };
}
