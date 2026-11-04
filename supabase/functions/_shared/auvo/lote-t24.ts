import { processarConcessaoT24 } from "./orquestracao-t24.ts";
import { criarRepositorioT24, type RpcT24 } from "./repositorio-t24.ts";
import { criarFornecedorT24, type TransporteT24 } from "./fornecedor-t24.ts";

type Parada="sem_trabalho"|"limite"|"prazo"|"incerto"|"erro";
export type ResultadoLoteT24={considerados:number;confirmados:number;bloqueados:number;reconciliacao:number;incertos:number;parada:Parada};
type Dependencias={rpc:RpcT24;criarTransporte:()=>TransporteT24;agora:()=>number};

/** Composição interna; chamada só por consumidor autenticado e autorizado. */
export async function processarLoteT24(entrada:{limite:number;prazoMs:number;paginas:number;itensPorPagina:number},d:Dependencias):Promise<ResultadoLoteT24>{
  if(!entrada||!Number.isSafeInteger(entrada.limite)||entrada.limite<1||entrada.limite>20||
    !Number.isSafeInteger(entrada.prazoMs)||entrada.prazoMs<1000||entrada.prazoMs>60000||
    !Number.isSafeInteger(entrada.paginas)||entrada.paginas<1||entrada.paginas>100||
    !Number.isSafeInteger(entrada.itensPorPagina)||entrada.itensPorPagina<1||entrada.itensPorPagina>100)throw new Error("Parâmetros de lote inválidos.");
  const inicio=d.agora();if(!Number.isFinite(inicio))throw new Error("Relógio inválido.");
  const resultado:ResultadoLoteT24={considerados:0,confirmados:0,bloqueados:0,reconciliacao:0,incertos:0,parada:"limite"};
  for(let i=0;i<entrada.limite;i++){
    const atual=d.agora();if(!Number.isFinite(atual)||atual<inicio){resultado.parada="erro";return resultado;}
    if(atual-inicio>=entrada.prazoMs){resultado.parada="prazo";return resultado;}
    try{
      const repo=criarRepositorioT24(d.rpc);
      const fornecedor=criarFornecedorT24(d.criarTransporte(),{paginas:entrada.paginas,itensPorPagina:entrada.itensPorPagina});
      const podeIniciar=()=>{const agora=d.agora();return Number.isFinite(agora)&&agora>=inicio&&agora-inicio<entrada.prazoMs;};
      const estado=await processarConcessaoT24(repo,fornecedor,podeIniciar);
      if(estado==="sem_trabalho"){resultado.parada="sem_trabalho";return resultado;}
      resultado.considerados++;
      if(estado==="confirmado")resultado.confirmados++;
      else if(estado==="bloqueado")resultado.bloqueados++;
      else if(estado==="reconciliacao")resultado.reconciliacao++;
      else{resultado.incertos++;resultado.parada="incerto";return resultado;}
    }catch{resultado.parada="erro";return resultado;}
  }
  return resultado;
}
