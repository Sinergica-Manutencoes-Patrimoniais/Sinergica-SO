import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { CandidatasT24 } from "./CandidatasT24";

const pedido = z.object({ requestId: z.string().guid(), visitaId: z.string().guid(), osId: z.string().guid(), revisao: z.number().int().positive(), protocolo:z.enum(["produtor_preventivo","produtor_corretivo"]).optional() }).strict();
type Pedido = z.infer<typeof pedido>;
const instante = z.string().datetime({ offset: true });
const resposta = z.object({ aggregateId: z.string().guid(), osId: z.string().guid(), revision: z.number().int().positive(), requestId: z.string().guid(),
  state: z.literal("bloqueada_sem_dispatch"), elegivelEm: instante, autorizaEnvio: z.literal(false) }).strict();
const respostaProdutor=z.object({requestId:z.string().guid(),tentativaId:z.string().guid(),outboxId:z.string().guid(),visitaId:z.string().guid(),osId:z.string().guid(),revision:z.number().int().positive(),protocolo:z.enum(["preventiva","corretiva"]),autorizaEnvio:z.literal(false)}).strict();
export function IntencaoLocalEnvio({ userId, clienteId, visitaId, osId, revisao, bloqueado }: { userId: string; clienteId: string; visitaId: string; osId: string; revisao: number; bloqueado: boolean }) {
  const chave = `sso-intencao-local:${JSON.stringify([userId, clienteId, visitaId, osId, revisao])}`;
  const cache=useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.visitaId === visitaId && p.osId === osId && p.revisao === revisao ? p : "invalido"; } catch { return "invalido"; } });
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  async function conferirSessao(signal?: AbortSignal) { const {data,error}=await supabase.auth.getUser(); if(error || data.user?.id!==userId || signal?.aborted)throw new Error("Sessão alterada."); }
  const bloqueios = useQuery({ queryKey: ["bloqueios-intencao-local", userId, clienteId, visitaId, osId, revisao],
    enabled: import.meta.env.VITE_SSO_BLOQUEIOS_INTENCAO_LOCAL_ENABLED === "true" && !bloqueado,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      await conferirSessao(signal);const { data, error } = await supabase.schema("pcm").rpc("sso_bloqueios_intencao_local", { p_cliente_id: clienteId, p_visita_id: visitaId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ visitaId: z.string().guid(), osId: z.string().guid(), revision: z.number().int().positive(), inicioJanela: instante,
        intencaoExistente: z.boolean(), bloqueios: z.array(z.string()), autorizaEnvio: z.literal(false) }).strict().parse(data);
      if (r.visitaId !== visitaId || r.osId !== osId) throw new Error("Resposta divergente"); await conferirSessao(signal);return r;
    } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { await conferirSessao();if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido local divergente."); const { data, error } = await supabase.schema("pcm").rpc(p.protocolo === "produtor_preventivo" ? "sso_t24_produzir_preventiva" : p.protocolo === "produtor_corretivo" ? "sso_t24_produzir_corretiva" : "sso_registrar_intencao_envio_local", {
    p_request_id: p.requestId, p_visita_id: p.visitaId, p_os_id: p.osId, p_revisao: p.revisao });
    if (error) throw error;
    if(p.protocolo){const r=respostaProdutor.parse(data);if(r.requestId!==p.requestId||r.visitaId!==p.visitaId||r.osId!==p.osId||r.revision!==p.revisao||r.protocolo!==(p.protocolo==="produtor_preventivo"?"preventiva":"corretiva"))throw new Error("Resposta divergente");await conferirSessao();return {tipo:"produtor" as const,resultado:r};}
    const r = resposta.parse(data);
    if (r.requestId !== p.requestId || r.aggregateId !== p.visitaId || r.osId !== p.osId || r.revision !== p.revisao) throw new Error("Resposta divergente"); await conferirSessao();return {tipo:"local" as const,resultado:r};
  }, onSuccess: async (r, p) => { try { await conferirSessao();if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente");
    await Promise.all([cache.invalidateQueries({queryKey:["t24-candidatas",userId,clienteId,visitaId,osId]}),cache.invalidateQueries({queryKey:["bloqueios-intencao-local",userId,clienteId,visitaId,osId]})]);
    await conferirSessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido divergente");sessionStorage.removeItem(chave); }
    catch { setAviso("Não foi possível conferir sessão ou pedido. Preserve a tentativa e consulte suporte."); return; }
    setPendente(null); setAviso(r.tipo === "produtor" ? `Candidata ${r.resultado.protocolo} registrada. Este registro não enviou nem criou tarefa externa.` : `Intenção local bloqueada registrada. Janela calculada: ${new Date(r.resultado.elegivelEm).toLocaleString("pt-BR")}. Este registro não enviou nem criou tarefa externa.`);
  }, onError: (erro) => {
    if (erro && typeof erro === "object" && "code" in erro && "message" in erro &&
      erro.code === "23514" && erro.message === "precisao_inicio_nao_suportada") {
      setAviso("O horário da Visita tem fração de segundo, não representável no contrato preparado. Revise a programação e procure suporte para reconciliar esta tentativa; nenhum horário será alterado automaticamente.");
      return;
    }
    setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte.");
  }, onSettled: () => { enviando.current = false; } });
  const recuperar = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao();if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido local divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_listar_intencoes_locais", { p_cliente_id: clienteId, p_visita_id: p.visitaId, p_request_id: p.requestId, p_apos: null });
    if (error) throw error;
    const r = z.array(z.object({ request_id: z.string().guid(), os_id: z.string().guid(), revisao: z.number().int().positive(), elegivel_em: instante, criado_em: instante }).strict()).length(1).parse(data)[0]!;
    if (r.request_id !== p.requestId || r.os_id !== p.osId || r.revisao !== p.revisao) throw new Error("Registro divergente"); await conferirSessao();return r;
  }, onSuccess: async (r, p) => { try { await conferirSessao();if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Não foi possível conferir sessão ou pedido. Preserve a tentativa e consulte suporte."); return; }
    setPendente(null); setAviso(`Registro local bloqueado localizado em ${new Date(r.criado_em).toLocaleString("pt-BR")}; este registro não enviou nem criou tarefa externa.`);
  }, onError: () => setAviso("Não foi possível confirmar o registro. Preserve o pedido e consulte suporte.") });
  const recuperarProdutor=useMutation({mutationFn:async(p:Pedido)=>{
    if(!p.protocolo)throw new Error("Protocolo divergente.");
    await conferirSessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido divergente.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_t24_consultar_recibo_produtor",{p_request_id:p.requestId,p_cliente_id:clienteId,p_visita_id:p.visitaId,p_os_id:p.osId,p_revisao:p.revisao});
    if(error)throw error;const r=respostaProdutor.parse(data);
    if(r.requestId!==p.requestId||r.visitaId!==p.visitaId||r.osId!==p.osId||r.revision!==p.revisao||r.protocolo!==(p.protocolo==="produtor_preventivo"?"preventiva":"corretiva"))throw new Error("Recibo divergente.");
    await conferirSessao();return r;
  },onSuccess:async(_r,p)=>{try{await cache.invalidateQueries({queryKey:["t24-candidatas",userId,clienteId,visitaId,osId]});
      await conferirSessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido divergente.");sessionStorage.removeItem(chave);
    }catch{setAviso("Recibo localizado, mas sessão ou tentativa mudou. Preserve o pedido e consulte suporte.");return;}
    setPendente(null);setAviso("Recibo da candidata localizado. Este registro não enviou nem criou tarefa externa.");
  },onError:()=>setAviso("Recibo indisponível. Preserve o pedido; isso não comprova ausência de tarefa externa.")});
  function enviar(p: Pedido) { if (bloqueado || enviando.current || recuperar.isPending || recuperarProdutor.isPending) return; try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente."); } catch { setAviso("Pedido local alterado ou indisponível. Consulte suporte antes de repetir."); return; } enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar(protocolo?: "produtor_preventivo"|"produtor_corretivo") { if (bloqueado || pendente || enviando.current || (protocolo==="produtor_preventivo"&&import.meta.env.VITE_SSO_PRODUTOR_T24_PREVENTIVO_ENABLED!=="true") || (protocolo==="produtor_corretivo"&&import.meta.env.VITE_SSO_PRODUTOR_T24_CORRETIVO_ENABLED!=="true")) return; try {
    const p = pedido.parse({ requestId: crypto.randomUUID(), visitaId, osId, revisao, ...(protocolo?{protocolo}:{}) });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Não foi possível guardar o pedido; nada foi enviado."); } }
  return <section><p>Registro local bloqueado: não aciona Auvo nem agenda execução.</p>
    {!bloqueado && <CandidatasT24 userId={userId} clienteId={clienteId} visitaId={visitaId} osId={osId}/>}
    {import.meta.env.VITE_SSO_BLOQUEIOS_INTENCAO_LOCAL_ENABLED === "true" && <>
      {bloqueios.isFetching && <p>Consultando bloqueios…</p>}
      {bloqueios.isError && <p role="alert">Bloqueios indisponíveis. <button type="button" onClick={() => void bloqueios.refetch()}>Tentar novamente</button></p>}
      {!bloqueios.isFetching && !bloqueios.isError && bloqueios.data && <div>
        <p>Prévia da revisão {bloqueios.data.revision} · janela {new Date(bloqueios.data.inicioJanela).toLocaleString("pt-BR")} · {bloqueios.data.intencaoExistente ? "intenção local já registrada" : "nenhuma intenção local encontrada"}.</p>
        <p>Bloqueios: {bloqueios.data.bloqueios.join(", ").replaceAll("_", " ")}. A prévia não autoriza envio.</p>
        {bloqueios.data.revision !== revisao && <p role="alert">A Visita mudou; atualize a tela.</p>}
      </div>}
    </>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <><button type="button" disabled={bloqueado || comando.isPending || recuperar.isPending || recuperarProdutor.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button>
      {pendente.protocolo && <button type="button" disabled={bloqueado || comando.isPending || recuperar.isPending || recuperarProdutor.isPending} onClick={() => {if(!enviando.current)recuperarProdutor.mutate(pendente);}}>Consultar recibo da candidata</button>}
      {!pendente.protocolo && import.meta.env.VITE_SSO_HISTORICO_INTENCAO_LOCAL_ENABLED === "true" && <button type="button" disabled={bloqueado || comando.isPending || recuperar.isPending || recuperarProdutor.isPending} onClick={() => recuperar.mutate(pendente)}>Consultar pedido registrado</button>}</> :
      !pendente && <><button type="button" disabled={bloqueado || comando.isPending} onClick={() => iniciar()}>Registrar intenção local bloqueada</button>
        {import.meta.env.VITE_SSO_PRODUTOR_T24_PREVENTIVO_ENABLED === "true" && <button type="button" disabled={bloqueado || comando.isPending} onClick={() => iniciar("produtor_preventivo")}>Preparar candidata preventiva</button>}
        {import.meta.env.VITE_SSO_PRODUTOR_T24_CORRETIVO_ENABLED === "true" && <button type="button" disabled={bloqueado || comando.isPending} onClick={() => iniciar("produtor_corretivo")}>{import.meta.env.VITE_SSO_PRODUTOR_T24_EMERGENCIAL_ENABLED === "true" ? "Preparar candidata corretiva ou emergencial" : "Preparar candidata corretiva"}</button>}
        {import.meta.env.VITE_SSO_PRODUTOR_T24_CORRETIVO_ENABLED === "true" && import.meta.env.VITE_SSO_PRODUTOR_T24_EMERGENCIAL_ENABLED === "true" && <p>Para emergencial, o servidor exige autorização e gate próprios. A janela T−24 e o contrato de envio ainda precisam de validação operacional.</p>}</>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
