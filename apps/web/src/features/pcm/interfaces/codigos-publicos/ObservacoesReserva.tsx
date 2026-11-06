import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z.object({ requestId: z.string().uuid(), outboxId: z.string().uuid(), componenteId: z.string().uuid(), observacao: z.string().min(1).max(2000) }).strict();
const reciboSchema = pedidoSchema.omit({ observacao: true }).extend({ criadoEm: z.string().datetime({ offset: true }) }).strict();
const linhaSchema = z.object({ request_id: z.string().uuid(), ator_id: z.string().uuid(), observacao: z.string().min(1).max(2000), criado_em: z.string().datetime({ offset: true }) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; outboxId: string; componenteId: string };
export function ObservacoesReserva(props: Props) {
  if (import.meta.env.VITE_SSO_OBSERVACOES_RESERVA_EQUIPMENT_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.outboxId,props.componenteId])} {...props} />;
}
function Conteudo({ userId,clienteId,outboxId,componenteId }: Props) {
  const chave = `sso-observacao-reserva:${JSON.stringify([userId,clienteId,outboxId,componenteId])}`;
  const [texto,setTexto] = useState(""); const [aviso,setAviso] = useState("");
  const [pendente,setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const valor=sessionStorage.getItem(chave); if (!valor) return null; const p=pedidoSchema.parse(JSON.parse(valor));
    return p.outboxId===outboxId && p.componenteId===componenteId ? p : "invalido";
  } catch { return "invalido"; } });
  const trava=useRef(false); const client=useQueryClient(); const queryKey=["observacoes-reserva-equipment",userId,clienteId,outboxId,componenteId];
  async function conferir(signal?: AbortSignal) { const r=await supabase.auth.getUser(); if (r.error || r.data.user?.id!==userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const consulta=useInfiniteQuery({ queryKey,gcTime:0,initialPageParam:null as string|null,queryFn:async ({pageParam,signal}) => {
    await conferir(signal); const parametros={p_ator_id:userId,p_cliente_id:clienteId,p_outbox_id:outboxId,p_componente_id:componenteId,p_apos:pageParam,p_limite:20};
    const requisicao=import.meta.env.VITE_SSO_OBSERVACOES_RESERVA_MEDIADAS_ENABLED==="true"
      ? supabase.schema("pcm").rpc("sso_listar_observacoes_reserva_mediada",parametros)
      : supabase.schema("pcm").rpc("sso_listar_observacoes_reserva",parametros);
    const {data,error}=await requisicao.abortSignal(signal);
    if(error) throw error; const pagina=z.array(linhaSchema).max(20).parse(data); let anterior=pageParam?.toLowerCase() ?? null;
    for(const item of pagina){const id=item.request_id.toLowerCase();if(anterior!==null && id<=anterior)throw new Error("Página inconsistente.");anterior=id;} await conferir(signal); return pagina;
  },getNextPageParam:p=>p.length===20 ? p[p.length-1]?.request_id : undefined });
  const envio=useMutation({mutationFn:async (p:Pedido)=>{
    if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente."); await conferir();
    const parametros={p_ator_id:userId,p_cliente_id:clienteId,p_request_id:p.requestId,p_outbox_id:p.outboxId,p_componente_id:p.componenteId,p_observacao:p.observacao};
    const requisicao=import.meta.env.VITE_SSO_OBSERVACOES_RESERVA_MEDIADAS_ENABLED==="true"
      ? supabase.schema("pcm").rpc("sso_observar_reserva_equipment_mediada",parametros)
      : supabase.schema("pcm").rpc("sso_observar_reserva_equipment",parametros);
    const {data,error}=await requisicao;
    if(error)throw error;const r=reciboSchema.parse(data);if(r.requestId!==p.requestId || r.outboxId!==p.outboxId || r.componenteId!==p.componenteId)throw new Error("Resposta divergente.");await conferir();
  },onSuccess:async (_r,p)=>{await client.invalidateQueries({queryKey});try{await conferir();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();sessionStorage.removeItem(chave);}catch{setAviso("Observação registrada, mas tentativa não foi removida. Consulte suporte.");return;}setPendente(null);setTexto("");setAviso("Observação registrada; confira a reserva para o estado atual.");},onError:()=>setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;} });
  function enviar(p:Pedido){if(trava.current || consulta.isFetching || consulta.isError)return;try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();}catch{setAviso("Tentativa indisponível. Consulte suporte.");return;}trava.current=true;setAviso("");envio.mutate(p);}
  function iniciar(){if(pendente || trava.current || consulta.isFetching || consulta.isError)return;try{const p=pedidoSchema.parse({requestId:crypto.randomUUID(),outboxId,componenteId,observacao:texto.trim()});if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira o texto e a sessão. Nada foi enviado.");}}
  return <section aria-label="Observações da reserva"><h3>Observações da reserva</h3><p>Não inclua senhas ou informações desnecessárias. A observação não confirma efeito no Auvo nem libera a reserva.</p>
    {consulta.isFetching && <output>Consultando observações…</output>}
    {consulta.isError && <p role="alert">Observações indisponíveis. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <>{consulta.data.pages.flat().length===0 ? <p>Nenhuma observação.</p> : <ul>{consulta.data.pages.flat().map(o=><li key={o.request_id}>{o.observacao} · {o.ator_id} · {new Date(o.criado_em).toLocaleString("pt-BR")}</li>)}</ul>}{consulta.hasNextPage && <button type="button" onClick={()=>void consulta.fetchNextPage()}>Mais observações</button>}
      {pendente==="invalido" && <p role="alert">Tentativa ilegível. Consulte suporte.</p>}
      {pendente && pendente!=="invalido" ? <p>Tentativa pendente. <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir tentativa</button></p> : !pendente && <form onSubmit={e=>{e.preventDefault();iniciar();}}><label>Observação <textarea required maxLength={2000} value={texto} onChange={e=>setTexto(e.target.value)} /></label><button type="submit" disabled={envio.isPending}>Registrar observação</button></form>}
    </>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
