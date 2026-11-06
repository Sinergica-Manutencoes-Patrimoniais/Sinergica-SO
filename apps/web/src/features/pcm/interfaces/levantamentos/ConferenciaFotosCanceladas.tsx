import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect,useRef,useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Props={userId:string;clienteId:string;loteId:string;chave:string};
const itemSchema=z.object({request_id:z.string().uuid(),cancelada_em:z.string(),ultima_observacao_em:z.string().nullable(),objeto_catalogado:z.boolean().nullable()}).strict();
const resultadoSchema=z.object({observacaoId:z.string().uuid(),requestId:z.string().uuid(),objetoCatalogado:z.boolean(),observadoEm:z.string()}).strict();
export function ConferenciaFotosCanceladas(p:Props){if(import.meta.env.VITE_SSO_FOTO_INGESTAO_SEGURA_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([p.userId,p.clienteId,p.loteId,p.chave])} {...p}/>;}
function Conteudo(p:Props){
 const consulta=useInfiniteQuery({queryKey:["conferencia-fotos-canceladas",p.userId,p.clienteId,p.loteId,p.chave],initialPageParam:null as string|null,gcTime:0,staleTime:0,retry:false,refetchOnWindowFocus:true,
  queryFn:async({pageParam,signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_listar_fotos_canceladas",{p_cliente_id:p.clienteId,p_lote_id:p.loteId,p_chave:p.chave,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;return z.array(itemSchema).max(20).parse(data);},getNextPageParam:pagina=>pagina.length===20?pagina.at(-1)?.request_id:undefined});
 return <section aria-label="Tentativas canceladas"><h5>Tentativas canceladas</h5><p>A conferência registra apenas metadados. Não apaga objetos nem prova presença física ou ausência atual.</p>
  {consulta.isFetching&&<p>Consultando tentativas…</p>}{consulta.isError&&<p role="alert">Tentativas indisponíveis ou acesso revogado. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
  {!consulta.isFetching&&!consulta.isError&&consulta.data?.pages.flat().length===0&&<p>Nenhuma reserva cancelada nesta linha.</p>}
  {!consulta.isFetching&&!consulta.isError&&consulta.data?.pages.flat().map(item=><Item key={item.request_id} {...p} item={item}/>)}
  {!consulta.isError&&consulta.hasNextPage&&<button type="button" onClick={()=>void consulta.fetchNextPage()}>Mais tentativas canceladas</button>}
 </section>;
}
function Item(p:Props&{item:z.infer<typeof itemSchema>}){
 const key=`sso-conferencia-foto-cancelada:${JSON.stringify([p.userId,p.clienteId,p.loteId,p.chave,p.item.request_id])}`;
 const [pendente,setPendente]=useState<string|"invalido"|null>(()=>{try{const raw=sessionStorage.getItem(key);if(!raw)return null;return z.string().uuid().parse(raw);}catch{return "invalido";}});
 const [aviso,setAviso]=useState("");const [ocupado,setOcupado]=useState(false);
 const montado=useRef(false);useEffect(()=>{montado.current=true;return()=>{montado.current=false;};},[]);
 async function conferir(){if(ocupado||pendente==="invalido")return;setOcupado(true);setAviso("");try{
  const observacaoId=pendente??crypto.randomUUID();if(!pendente){if(sessionStorage.getItem(key)!==null)throw new Error("tentativa_existente");sessionStorage.setItem(key,observacaoId);setPendente(observacaoId);}
  const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==p.userId)throw new Error("sessao_alterada");
  const {data,error}=await supabase.schema("pcm").rpc("sso_conferir_foto_cancelada",{p_observacao_id:observacaoId,p_cliente_id:p.clienteId,p_request_id:p.item.request_id,p_lote_id:p.loteId,p_chave:p.chave});if(error)throw error;
  const r=resultadoSchema.parse(data);if(r.observacaoId!==observacaoId||r.requestId!==p.item.request_id||sessionStorage.getItem(key)!==observacaoId)throw new Error("resposta_divergente");
  const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==p.userId||!montado.current)throw new Error("sessao_alterada");
  sessionStorage.removeItem(key);setPendente(null);setAviso(`Conferência registrada em ${new Date(r.observadoEm).toLocaleString("pt-BR")}: ${r.objetoCatalogado?"objeto catalogado":"objeto não catalogado"}. Isso não prova presença física ou ausência atual.`);
 }catch{if(montado.current)setAviso("Resultado não confirmado. Repita a mesma conferência ou consulte suporte.");}finally{if(montado.current)setOcupado(false);}}
 return <article><p>{p.item.request_id}</p><p>Cancelada em {new Date(p.item.cancelada_em).toLocaleString("pt-BR")}</p>
  {p.item.ultima_observacao_em&&<p>Última conferência: {new Date(p.item.ultima_observacao_em).toLocaleString("pt-BR")} · {p.item.objeto_catalogado?"catalogado":"não catalogado"} naquele instante.</p>}
  <button type="button" disabled={ocupado||pendente==="invalido"} onClick={()=>void conferir()}>{pendente?"Repetir conferência":"Conferir catálogo"}</button>
  {pendente==="invalido"&&<p role="alert">Tentativa local ilegível. Consulte suporte.</p>}{aviso&&<p role="status">{aviso}</p>}
 </article>;
}
