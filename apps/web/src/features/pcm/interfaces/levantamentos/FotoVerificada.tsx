import { useEffect,useRef,useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
export function FotoVerificada(p:{userId:string;fotoId:string}){if(import.meta.env.VITE_SSO_FOTO_INGESTAO_SEGURA_ENABLED!=="true")return null;return <Conteudo key={`${p.userId}:${p.fotoId}`} {...p}/>;}
function Conteudo({userId,fotoId}:{userId:string;fotoId:string}){
 const [url,setUrl]=useState<string|null>(null);const [erro,setErro]=useState(false);const [ocupado,setOcupado]=useState(false);const montado=useRef(false);
 useEffect(()=>{montado.current=true;return()=>{montado.current=false;};},[]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 async function abrir(){setOcupado(true);setErro(false);try{
  const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId)throw new Error("sessao_alterada");
  const {data,error}=await supabase.functions.invoke<Blob>("pcm-foto-ingestao-leitura-segura",{body:{},headers:{"x-foto-id":fotoId}});
  if(error||!(data instanceof Blob)||!["image/jpeg","image/png"].includes(data.type)||data.size===0||data.size>10485760)throw new Error("foto_indisponivel");
  const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||!montado.current)throw new Error("sessao_alterada");
  setUrl(URL.createObjectURL(data));
 }catch{if(montado.current)setErro(true);}finally{if(montado.current)setOcupado(false);}}
 return <div>{url?<><img src={url} alt="Foto do levantamento com integridade verificada"/><button type="button" onClick={()=>setUrl(null)}>Ocultar foto verificada</button></>:<button type="button" disabled={ocupado} onClick={()=>void abrir()}>Ver foto com verificação</button>}{erro&&<p role="alert">Foto verificada indisponível ou acesso revogado.</p>}</div>;
}
