import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { GrupoQuantitativo } from "../../application/estrutura-tecnica-gateway";
import { estruturaTecnicaQueryKeys } from "../../application/estrutura-tecnica-queries";

const schema=z.object({requestId:z.string().uuid(),userId:z.string().uuid(),clienteId:z.string().uuid(),grupoId:z.string().uuid(),revision:z.number().int().positive(),categoriaId:z.string().uuid(),sistemaId:z.string().uuid().nullable(),motivo:z.string().min(1).max(2000)}).strict();
type Pedido=z.infer<typeof schema>;
type Props={userId:string;clienteId:string;grupo:GrupoQuantitativo;categorias:{id:string;nome:string}[];sistemas:{id:string;nome:string}[];disponivel:boolean};
export function ReclassificarGrupo(props:Props){
  if(import.meta.env.VITE_SSO_RECLASSIFICAR_GRUPO_ENABLED!=="true")return null;
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.grupo.id])} {...props}/>;
}
function Conteudo({userId,clienteId,grupo,categorias,sistemas,disponivel}:Props){
  const key=`sso-reclassificar-grupo:${JSON.stringify([userId,clienteId,grupo.id])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const raw=sessionStorage.getItem(key);if(!raw)return null;const p=schema.parse(JSON.parse(raw));return p.userId===userId && p.clienteId===clienteId && p.grupoId===grupo.id ? p : "invalido";}catch{return "invalido";}});
  const [aberto,setAberto]=useState(false);const [revisaoConferida,setRevisaoConferida]=useState(grupo.revisao);const [categoria,setCategoria]=useState(grupo.categoriaId);const [sistema,setSistema]=useState(grupo.sistemaId ?? "");const [motivo,setMotivo]=useState("");const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const envio=useMutation({mutationFn:async(p:Pedido)=>{const {data,error}=await supabase.schema("pcm").rpc("sso_reclassificar_grupo_autorizado",{p_request_id:p.requestId,p_grupo_id:p.grupoId,p_expected_revision:p.revision,p_categoria_id:p.categoriaId,p_sistema_id:p.sistemaId,p_motivo:p.motivo});if(error)throw error;
    const r=z.object({aggregateId:z.string().uuid(),revision:z.number().int().positive(),requestId:z.string().uuid(),categoriaId:z.string().uuid(),sistemaId:z.string().uuid().nullable()}).strict().parse(data);
    if(r.aggregateId!==p.grupoId || r.revision!==p.revision+1 || r.requestId!==p.requestId || r.categoriaId!==p.categoriaId || r.sistemaId!==p.sistemaId)throw new Error("Resposta divergente");
  },onSuccess:async(_r,p)=>{try{if(sessionStorage.getItem(key)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(key);}catch{setAviso("Reclassificação confirmada; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setAberto(false);setAviso("Reclassificação registrada.");await Promise.all([client.invalidateQueries({queryKey:estruturaTecnicaQueryKeys.grupos(userId,clienteId)}),client.invalidateQueries({queryKey:estruturaTecnicaQueryKeys.historico(userId,clienteId,grupo.id)})]);},onError:()=>setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current || !disponivel)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(!disponivel || grupo.revisao!==revisaoConferida || pendente || trava.current || !categorias.some(c=>c.id===categoria) || (sistema && !sistemas.some(s=>s.id===sistema)) || (categoria===grupo.categoriaId && (sistema || null)===grupo.sistemaId))return;try{const p=schema.parse({requestId:crypto.randomUUID(),userId,clienteId,grupoId:grupo.id,revision:revisaoConferida,categoriaId:categoria,sistemaId:sistema || null,motivo:motivo.trim()});if(sessionStorage.getItem(key)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(key,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira os dados e a sessão. Nada foi enviado.");}}
  return <section aria-label={`Reclassificar ${grupo.nome}`}>
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={!disponivel || envio.isPending} onClick={()=>enviar(pendente)}>Repetir reclassificação</button> : !pendente && <><button type="button" disabled={!disponivel} onClick={()=>{if(!aberto){setRevisaoConferida(grupo.revisao);setCategoria(grupo.categoriaId);setSistema(grupo.sistemaId ?? "");setMotivo("");}setAberto(v=>!v);}}>Reclassificar</button>{aberto && <form onSubmit={e=>{e.preventDefault();iniciar();}}>
      <p>Quantidade, características e Local serão preservados. Revisão conferida: {revisaoConferida}.</p>
      {grupo.revisao!==revisaoConferida && <p role="alert">O grupo mudou. Feche e abra novamente para conferir a revisão atual.</p>}
      <label>Categoria <select required value={categoria} onChange={e=>setCategoria(e.target.value)}><option value="">Selecione</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label>Sistema <select value={sistema} onChange={e=>setSistema(e.target.value)}><option value="">Sem vínculo</option>{sistemas.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}</select></label>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={e=>setMotivo(e.target.value)} /></label>
      <button type="submit" disabled={!disponivel || grupo.revisao!==revisaoConferida || envio.isPending || !motivo.trim()}>Confirmar reclassificação</button>
    </form>}</>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
