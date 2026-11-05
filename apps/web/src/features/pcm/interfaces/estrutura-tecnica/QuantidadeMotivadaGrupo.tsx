import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { GrupoQuantitativo } from "../../application/estrutura-tecnica-gateway";
import { estruturaTecnicaQueryKeys } from "../../application/estrutura-tecnica-queries";

const schema=z.object({requestId:z.string().uuid(),userId:z.string().uuid(),clienteId:z.string().uuid(),grupoId:z.string().uuid(),revision:z.number().int().positive(),quantidade:z.number().int().safe().positive(),motivo:z.string().min(1).max(2000)}).strict();
type Pedido=z.infer<typeof schema>;
type Props={userId:string;clienteId:string;grupo:GrupoQuantitativo;disponivel:boolean};
export function QuantidadeMotivadaGrupo(props:Props){if(import.meta.env.VITE_SSO_QUANTIDADE_MOTIVADA_GRUPO_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.grupo.id])} {...props}/>;}
function Conteudo({userId,clienteId,grupo,disponivel}:Props){
  const key=`sso-quantidade-grupo:${JSON.stringify([userId,clienteId,grupo.id])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const raw=sessionStorage.getItem(key);if(!raw)return null;const p=schema.parse(JSON.parse(raw));return p.userId===userId && p.clienteId===clienteId && p.grupoId===grupo.id ? p : "invalido";}catch{return "invalido";}});
  const [aberto,setAberto]=useState(false);const [revisaoConferida,setRevisaoConferida]=useState(grupo.revisao);const [quantidade,setQuantidade]=useState("");const [motivo,setMotivo]=useState("");const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada.");
  }
  const envio=useMutation({mutationFn:async(p:Pedido)=>{ await conferirSessao(); if (sessionStorage.getItem(key) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");const {data,error}=await supabase.schema("pcm").rpc("sso_quantidade_grupo_autorizada",{p_request_id:p.requestId,p_grupo_id:p.grupoId,p_expected_revision:p.revision,p_quantidade:p.quantidade,p_motivo:p.motivo});if(error)throw error;
    const r=z.object({aggregateId:z.string().uuid(),revision:z.number().int().positive(),requestId:z.string().uuid(),quantidade:z.number().int().safe().positive()}).strict().parse(data);
    if(r.aggregateId!==p.grupoId || r.revision!==p.revision+1 || r.requestId!==p.requestId || r.quantidade!==p.quantidade)throw new Error("Resposta divergente");
  },onSuccess:async(_r,p)=>{try{ await conferirSessao();if(sessionStorage.getItem(key)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(key);}catch{setAviso("Alteração confirmada; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setAberto(false);setAviso("Quantidade atualizada.");await Promise.all([client.invalidateQueries({queryKey:estruturaTecnicaQueryKeys.grupos(userId,clienteId)}),client.invalidateQueries({queryKey:estruturaTecnicaQueryKeys.historico(userId,clienteId,grupo.id)})]);},onError:()=>setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current || !disponivel)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(!disponivel || grupo.revisao!==revisaoConferida || pendente || trava.current || !/^[1-9][0-9]*$/.test(quantidade) || Number(quantidade)===grupo.quantidade)return;try{const p=schema.parse({requestId:crypto.randomUUID(),userId,clienteId,grupoId:grupo.id,revision:revisaoConferida,quantidade:Number(quantidade),motivo:motivo.trim()});if(sessionStorage.getItem(key)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(key,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira os dados e a sessão. Nada foi enviado.");}}
  return <section aria-label={`Alterar quantidade de ${grupo.nome}`}>
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={!disponivel || envio.isPending} onClick={()=>enviar(pendente)}>Repetir alteração</button> : !pendente && <><button type="button" disabled={!disponivel} onClick={()=>{if(!aberto){setRevisaoConferida(grupo.revisao);setQuantidade(String(grupo.quantidade));setMotivo("");}setAberto(v=>!v);}}>Alterar quantidade com motivo</button>{aberto && <form onSubmit={e=>{e.preventDefault();iniciar();}}>
      <p>Quantidade atual: {grupo.quantidade}. Revisão conferida: {revisaoConferida}. Outros campos serão preservados.</p>
      {grupo.revisao!==revisaoConferida && <p role="alert">O grupo mudou. Feche e abra novamente para conferir a revisão atual.</p>}
      <label>Nova quantidade <input required type="number" min="1" max="9007199254740991" step="1" value={quantidade} onChange={e=>setQuantidade(e.target.value)} /></label>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={e=>setMotivo(e.target.value)} /></label>
      <button type="submit" disabled={!disponivel || grupo.revisao!==revisaoConferida || envio.isPending || !motivo.trim() || !quantidade}>Confirmar alteração</button>
    </form>}</>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
