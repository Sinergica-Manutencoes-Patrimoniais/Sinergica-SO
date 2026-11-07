import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid();
const destinoSchema = z.object({ fotoId: id, grupoId: id.nullable(), grupoAtivo: z.boolean().nullable(),
  revision: z.number().int().nonnegative(), decisao: z.enum(["aceita", "rejeitada"]).nullable(),
  ingestaoConfirmada: z.boolean(), inadequada: z.boolean(), retirada: z.boolean(), vinculado: z.boolean() }).strict();
const pedidoSchema = z.object({ atorId: id, clienteId: id, requestId: id, fotoId: id, grupoId: id,
  revision: z.number().int().positive() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; fotoId: string };

export function VincularFotoVerificadaGrupo(props: Props) {
  if (import.meta.env.VITE_SSO_VINCULAR_FOTO_VERIFICADA_GRUPO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.fotoId])} {...props} />;
}
function Conteudo({ userId, clienteId, fotoId }: Props) {
  const chave = `sso-foto-verificada-grupo:${JSON.stringify([userId, clienteId, fotoId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === userId && p.clienteId === clienteId && p.fotoId === fotoId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false); const cache = useQueryClient();
  async function conferirSessao(signal?: AbortSignal) {
    const {data,error} = await supabase.auth.getUser();
    if(error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const consulta = useQuery({ queryKey:["foto-verificada-grupo-destino",userId,clienteId,fotoId], gcTime:0, retry:false,
    queryFn: async ({signal}) => {
      await conferirSessao(signal);
      const {data,error} = await supabase.schema("pcm").rpc("sso_destino_foto_verificada_grupo", {
        p_ator_id:userId,p_cliente_id:clienteId,p_foto_id:fotoId,
      }).abortSignal(signal);
      if(error) throw error;
      const r=destinoSchema.parse(data);
      if(r.fotoId!==fotoId || ((r.grupoId===null)!==(r.grupoAtivo===null))) throw new Error("Destino divergente.");
      await conferirSessao(signal); return r;
    },
  });
  const r = !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  const fotografia = r ? JSON.stringify([userId, clienteId, r]) : null;
  const elegivel = !!r && r.grupoId !== null && r.grupoAtivo === true && r.decisao === "aceita"
    && r.ingestaoConfirmada && !r.inadequada && !r.retirada && !r.vinculado && r.revision > 0;
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao(); if(sessionStorage.getItem(chave)!==JSON.stringify(p)) throw new Error("Tentativa alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_vincular_foto_verificada_grupo", {
        p_ator_id:p.atorId,p_cliente_id:p.clienteId,p_request_id:p.requestId,p_foto_id:p.fotoId,
        p_grupo_id:p.grupoId,p_decisao_revision:p.revision,
      });
      if(error) throw error;
      const recebido=z.object({requestId:id,vinculoId:id,fotoId:id,grupoId:id,revision:z.number().int().positive(),bytesCopiados:z.literal(false)}).strict().parse(data);
      if(recebido.requestId!==p.requestId || recebido.fotoId!==p.fotoId || recebido.grupoId!==p.grupoId || recebido.revision!==p.revision) throw new Error("Recibo divergente.");
      await conferirSessao();
    },
    onSuccess: async (_resultado,p) => {
      try {
        await cache.invalidateQueries({queryKey:["foto-verificada-grupo-destino",userId,clienteId,fotoId]});
        await cache.invalidateQueries({queryKey:["estrutura-tecnica",userId,clienteId]});
        await conferirSessao();
        if(sessionStorage.getItem(chave)!==JSON.stringify(p)) throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave);
      } catch { setAviso("Vínculo confirmado, mas a tentativa local não foi limpa. Procure suporte."); return; }
      setPendente(null); setConfirmacao(null); setAviso("Vínculo registrado. A foto não foi copiada nem publicada.");
    },
    onError: () => setAviso("Resultado não confirmado. Preserve a tentativa e repita somente o mesmo pedido ou procure suporte."),
    onSettled: () => { trava.current=false; },
  });
  function enviar(p: Pedido) {
    if(trava.current) return;
    try { if(sessionStorage.getItem(chave)!==JSON.stringify(p)) throw new Error(); }
    catch { setAviso("Tentativa local divergente. Procure suporte."); return; }
    trava.current=true; envio.mutate(p);
  }
  function iniciar() {
    if(!r || !r.grupoId || !elegivel || !fotografia || confirmacao!==fotografia || pendente || trava.current) return;
    try {
      const p=pedidoSchema.parse({atorId:userId,clienteId,requestId:crypto.randomUUID(),fotoId,grupoId:r.grupoId,revision:r.revision});
      if(sessionStorage.getItem(chave)!==null) throw new Error();
      sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);
    } catch { setAviso("Não foi possível guardar a tentativa; nada foi enviado."); }
  }
  return <section aria-label="Vincular foto verificada ao Grupo">
    <h5>Foto verificada do Grupo</h5><p>O vínculo usa a foto aceita da mesma linha incorporada; não copia ou publica o arquivo.</p>
    {consulta.isFetching && <output>Consultando destino…</output>}
    {consulta.isError && <p role="alert">Destino indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {r && <p>Grupo: {r.grupoId ?? "não identificado"} · decisão: {r.decisao ?? "não decidida"} · revisão {r.revision} · {r.ingestaoConfirmada ? "ingestão confirmada" : "sem ingestão verificada"} · {r.vinculado ? "vínculo registrado" : "sem vínculo"}.</p>}
    {pendente==="invalido" ? <p role="alert">Tentativa ilegível. Procure suporte.</p> : pendente
      ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir mesmo vínculo</button>
      : <><label><input type="checkbox" checked={Boolean(fotografia && confirmacao===fotografia)} disabled={!elegivel || envio.isPending}
          onChange={e=>setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi a foto, decisão e Grupo.</label>
        <button type="button" disabled={!elegivel || !fotografia || confirmacao!==fotografia || envio.isPending} onClick={iniciar}>Vincular foto verificada</button></>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
