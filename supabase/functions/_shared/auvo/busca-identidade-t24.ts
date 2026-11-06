type Objeto=Record<string,unknown>;
type Pagina={itens:unknown[];proximo:string|null;coberturaComprovada:boolean};
export type LeitorPaginaIdentidadeT24=(entrada:{osId:string;cursor:string|null;limite:number})=>Promise<Pagina>;
type Resultado={completa:boolean;identidadeComprovada:boolean;itens:unknown[]};
const uuid=(x:unknown):x is string=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const objeto=(x:unknown):x is Objeto=>!!x&&typeof x==="object"&&!Array.isArray(x);
const inconclusiva=():Resultado=>({completa:false,identidadeComprovada:false,itens:[]});

/** Leitor deve provar cobertura total e entregar cursor opaco; não realiza rede por conta própria. */
export async function buscarIdentidadeT24(entrada:{osId:string;campoExternalId:string;contratoComprovado:boolean;limitePaginas:number;limitePagina:number},ler:LeitorPaginaIdentidadeT24):Promise<Resultado>{
  if(!uuid(entrada?.osId)||entrada.contratoComprovado!==true||typeof entrada.campoExternalId!=="string"||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(entrada.campoExternalId)||
    !Number.isSafeInteger(entrada.limitePaginas)||entrada.limitePaginas<1||entrada.limitePaginas>100||!Number.isSafeInteger(entrada.limitePagina)||entrada.limitePagina<1||entrada.limitePagina>100)return inconclusiva();
  const cursores=new Set<string>();const itens:unknown[]=[];let cursor:string|null=null;
  try{
    for(let pagina=0;pagina<entrada.limitePaginas;pagina++){
      const r=await ler({osId:entrada.osId,cursor,limite:entrada.limitePagina});
      if(!r||r.coberturaComprovada!==true||!Array.isArray(r.itens)||r.itens.length>entrada.limitePagina||!(r.proximo===null||(typeof r.proximo==="string"&&r.proximo.length>0&&r.proximo.length<=500)))return inconclusiva();
      for(const item of r.itens){if(!objeto(item)||typeof item[entrada.campoExternalId]!=="string"||!(item[entrada.campoExternalId] as string).trim())return inconclusiva();
        if((item[entrada.campoExternalId] as string).toLowerCase()===entrada.osId.toLowerCase())itens.push(item);}
      if(r.proximo===null)return {completa:true,identidadeComprovada:true,itens};
      if(cursores.has(r.proximo)||r.proximo===cursor)return inconclusiva();cursores.add(r.proximo);cursor=r.proximo;
    }
  }catch{return inconclusiva();}
  return inconclusiva();
}
