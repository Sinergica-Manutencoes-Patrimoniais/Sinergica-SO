import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const schema = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), osId: z.string().uuid(), propostaId: z.string().uuid(),
  revisao: z.number().int().positive().safe(), motivo: z.string().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof schema>;
type Props = { userId: string; clienteId: string; osId: string; propostaId: string; revisao: number;
  internos: number | null; terceiros: number | null; acompanhamento: number | null; jaConfirmado: boolean };
export function ConfirmarEsforcoRestante(props: Props) {
  return <Formulario key={JSON.stringify([props.userId,props.clienteId,props.osId,props.propostaId])} {...props} />;
}
function Formulario({ userId, clienteId, osId, propostaId, revisao, internos, terceiros, acompanhamento, jaConfirmado }: Props) {
  const chave = `sso-esforco-restante:${JSON.stringify([userId,clienteId,osId,propostaId])}`;
  const client = useQueryClient(); const trava = useRef(false);
  const [motivo,setMotivo] = useState(""); const [confirmado,setConfirmado] = useState<string|null>(null); const [aviso,setAviso] = useState("");
  const [ocupado,setOcupado] = useState(false);
  const [pendente,setPendente] = useState<Pedido|"invalido"|null>(() => { try {
    const raw=sessionStorage.getItem(chave); if(!raw)return null; const p=schema.parse(JSON.parse(raw));
    return p.clienteId===clienteId && p.osId===osId && p.propostaId===propostaId ? p : "invalido";
  } catch { return "invalido"; } });
  const dadosValidos = Number.isSafeInteger(revisao) && revisao>0 && [internos,terceiros,acompanhamento].every(v=>v!==null && Number.isSafeInteger(v) && v>=0) &&
    (internos!==0 || terceiros!==0 || acompanhamento!==0);
  const foto=JSON.stringify([userId,clienteId,osId,propostaId,revisao,internos,terceiros,acompanhamento,motivo.trim()]);
  async function enviar(p:Pedido,repeticao:boolean) {
    if(trava.current)return; trava.current=true; setOcupado(true); setAviso("");
    try {
      const antes=await supabase.auth.getUser(); if(antes.error || antes.data.user?.id!==userId)throw new Error();
      const salvo=sessionStorage.getItem(chave); if(repeticao ? salvo!==JSON.stringify(p) : salvo!==null)throw new Error();
      if(!repeticao)sessionStorage.setItem(chave,JSON.stringify(p)); setPendente(p);
      const {data,error}=await supabase.schema("pcm").rpc("sso_confirmar_esforco_restante",{
        p_request_id:p.requestId,p_cliente_id:p.clienteId,p_os_id:p.osId,p_proposta_id:p.propostaId,p_esforco_revision:p.revisao,p_motivo:p.motivo,
      });
      if(error)throw error;
      if(!data || data.requestId!==p.requestId || data.clienteId!==p.clienteId || data.osId!==p.osId || data.propostaId!==p.propostaId || data.esforcoRevision!==p.revisao || data.restanteConfirmado!==true)throw new Error();
      const depois=await supabase.auth.getUser(); if(depois.error || depois.data.user?.id!==userId || sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();
      sessionStorage.removeItem(chave); setPendente(null); setConfirmado(null);
      setAviso("Esforço restante confirmado para esta revisão; reconsulte as fontes.");
      void client.invalidateQueries({queryKey:["capacidade-fontes-demanda",userId,clienteId]});
    } catch { setAviso("Resultado não confirmado. Mantenha a tentativa e procure suporte em caso de conflito."); }
    finally {trava.current=false; setOcupado(false);}
  }
  if (jaConfirmado && !pendente) return null;
  return <section aria-label="Confirmar esforço restante">
    <p>Confirme somente se estes valores representam o trabalho ainda necessário nesta OS, sem incluir o que já foi executado.</p>
    <p>Revisão {revisao} · equipe própria {internos ?? "não informada"} · terceiros {terceiros ?? "não informados"} · acompanhamento {acompanhamento ?? "não informado"} minutos-homem.</p>
    {pendente==="invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    {ocupado && <p role="status">Confirmando esforço restante…</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={ocupado} onClick={()=>void enviar(pendente,true)}>Repetir mesma tentativa</button> : !pendente && <>
      {!dadosValidos && <p>Informe esforço completo e não totalmente zero antes de confirmar.</p>}
      <label>Motivo <input maxLength={2000} disabled={ocupado} value={motivo} onChange={e=>{setMotivo(e.target.value);setConfirmado(null);}} /></label>
      <label><input type="checkbox" disabled={!dadosValidos || ocupado} checked={confirmado===foto} onChange={e=>setConfirmado(e.target.checked?foto:null)} /> Conferi os valores e confirmo que são apenas o esforço restante.</label>
      <button type="button" disabled={!dadosValidos || !motivo.trim() || confirmado!==foto || ocupado} onClick={()=>void enviar({requestId:crypto.randomUUID(),clienteId,osId,propostaId,revisao,motivo:motivo.trim()},false)}>Confirmar esforço restante</button>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
