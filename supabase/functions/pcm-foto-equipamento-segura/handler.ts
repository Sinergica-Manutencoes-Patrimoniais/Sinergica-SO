type Identidade = { usuario: string; userRole: string };
type Dependencias = {
  identidade: (req: Request) => Promise<Identidade>;
  limitar: (usuario: string) => Promise<boolean>;
  resolver: (id: string, identidade: Identidade) => Promise<string | null>;
  baixar: (caminho: string) => Promise<Blob>;
  cors: (origem: string | null) => Record<string, string>;
};

export function criarHandler(deps: Dependencias) {
  return async (req: Request): Promise<Response> => {
    const cors=deps.cors(req.headers.get("origin"));
    const falha=(status:number)=>new Response(JSON.stringify({title:"Foto indisponível",status}),{status,headers:{...cors,"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
    if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
    if(req.method!=="POST")return falha(405);
    let identidade:Identidade;try{identidade=await deps.identidade(req);}catch{return falha(401);}
    try{
      if(!await deps.limitar(identidade.usuario))return falha(429);
      if(!req.body)return falha(422);const leitor=req.body.getReader();const dec=new TextDecoder("utf-8",{fatal:true});let texto="";let tamanho=0;
      for(;;){const {done,value}=await leitor.read();if(done)break;tamanho+=value.byteLength;if(tamanho>4096){void leitor.cancel().catch(()=>{});return falha(413);}texto+=dec.decode(value,{stream:true});}
      let dados:unknown;try{dados=JSON.parse(texto+dec.decode());}catch{return falha(422);}
      if(!dados || typeof dados!=="object" || Array.isArray(dados) || Object.keys(dados).length!==1 || !("vinculoId" in dados) || typeof dados.vinculoId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dados.vinculoId))return falha(422);
      const vinculoId=dados.vinculoId;const caminho=await deps.resolver(vinculoId,identidade);if(!caminho)return falha(404);
      const arquivo=await deps.baixar(caminho);if(arquivo.size>10485760)return falha(413);
      const bytes=new Uint8Array(await arquivo.arrayBuffer());const jpeg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;const png=bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);if(!jpeg && !png)return falha(415);
      let atual:Identidade;try{atual=await deps.identidade(req);}catch{return falha(401);}
      if(atual.usuario!==identidade.usuario || atual.userRole!==identidade.userRole)return falha(401);
      if(await deps.resolver(vinculoId,identidade)!==caminho)return falha(404);
      return new Response(bytes,{headers:{...cors,"Content-Type":jpeg ? "image/jpeg" : "image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
    }catch{return falha(503);}
  };
}
