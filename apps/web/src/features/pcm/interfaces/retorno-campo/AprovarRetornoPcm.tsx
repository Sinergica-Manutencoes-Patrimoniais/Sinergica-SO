import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { FinalizarOsValidada } from "./FinalizarOsValidada";
import { AprovarFinalizarAtomico } from "./AprovarFinalizarAtomico";
type Pedido = { requestId: string; clienteId: string; retornoId: string; conferenciaId: string; evidencias: number; decisao: number; justificativa: string };
const respostaAprovacao = z.object({ retornoId: z.string().uuid(), condicaoEvidenciaId: z.string().uuid(), decisaoId: z.string().uuid(), revision: z.number().int().positive(), pendenciasProcessadas: z.number().int().nonnegative(), osEncerrada: z.literal(false), conteudoAutenticado: z.literal(false), requestId: z.string().uuid() }).strict();
const historicoSchema = z.object({request_id:z.string().uuid(),condicao_evidencia_id:z.string().uuid(),decisao_id:z.string().uuid(),revisao_decisao:z.number().int().positive(),justificativa:z.string(),ator_id:z.string().uuid(),criado_em:z.string().datetime({offset:true})}).strict();

export function AprovarRetornoPcm(props: Parameters<typeof Conteudo>[0]) { return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.retornoId, props.conferenciaId])} {...props} />; }
function Conteudo({ userId, clienteId, retornoId, conferenciaId, evidencias, decisao, historicoCompleto }: { userId: string; clienteId: string; retornoId: string; conferenciaId: string; evidencias: number; decisao: number; historicoCompleto: boolean }) {
  const montado = useRef(false); useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const cache = useQueryClient(); const storageKey = `sso-atestacao-pcm:${JSON.stringify([userId, clienteId, retornoId, conferenciaId])}`;
  const trava = useRef(false);
  const [confirmado, setConfirmado] = useState<string | null>(null); const [justificativa, setJustificativa] = useState(""); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as Pedido;
    return p.clienteId === clienteId && p.retornoId === retornoId && p.conferenciaId === conferenciaId && typeof p.requestId === "string" && Number.isSafeInteger(p.evidencias) && Number.isSafeInteger(p.decisao) && typeof p.justificativa === "string" ? p : "invalido";
  } catch { return "invalido"; } });
  const permissao = useQuery({ queryKey: ["retorno-aprovar-permissao", userId, clienteId], gcTime: 0, refetchOnWindowFocus: true, queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("execucao.validar", clienteId) });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const historico = useInfiniteQuery({ queryKey: ["retorno-atestacoes-pcm", userId, clienteId, retornoId], enabled: permitido, gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_atestacoes_pcm_mediada", { p_cliente_id: clienteId, p_retorno_id: retornoId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error;
      const pagina=z.array(historicoSchema).max(20).parse(data);let anterior=pageParam?.toLowerCase()??"";for(const item of pagina){const atual=item.request_id.toLowerCase();if(atual<=anterior)throw new Error("Página divergente.");anterior=atual;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina; }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.request_id : undefined });
  const envio = useMutation({ mutationFn: async (p: Pedido) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId|| !montado.current ||sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_atestar_aprovar_retorno_mediado", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_retorno_id: p.retornoId, p_conferencia_id: p.conferenciaId, p_expected_evidencias: p.evidencias, p_expected_decisao: p.decisao, p_justificativa: p.justificativa }); if (error) throw error; const resultado = respostaAprovacao.parse(data); if (resultado.requestId.toLowerCase() !== p.requestId.toLowerCase() || resultado.retornoId.toLowerCase() !== p.retornoId.toLowerCase() || resultado.revision !== p.decisao + 1) throw new Error("Resposta não corresponde ao pedido.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");return resultado;
  }, onSuccess: async (r,p) => { try {
    await cache.invalidateQueries({ queryKey: ["retorno-atestacoes-pcm", userId, clienteId, retornoId] }); await cache.invalidateQueries({ queryKey: ["retorno-decisoes", userId, clienteId, retornoId] });
    const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId|| !montado.current ||sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");sessionStorage.removeItem(storageKey);
    setPendente(null); setConfirmado(null); setAviso(`Retorno aprovado pelo PCM; ${r.pendenciasProcessadas} Não OK processada(s). OS e Chamado não foram encerrados; conteúdo não foi autenticado.`);
  } catch { setAviso("Decisão confirmada, mas tentativa local não pôde ser removida; procure suporte."); }
  }, onError: () => setAviso("Resultado não confirmado ou requisitos mudaram. Repita a mesma tentativa; procure suporte em conflito."),onSettled:()=>{trava.current=false;} });
  const enviar = (p: Pedido,repetir=false) => { if (trava.current) return; if (!permitido) { setAviso("Permissão atual indisponível; tentativa permanece guardada."); return; } try { const salva=sessionStorage.getItem(storageKey);if((repetir&&salva!==JSON.stringify(p))||(!repetir&&salva!==null))throw new Error("Tentativa divergente.");if(!repetir)sessionStorage.setItem(storageKey, JSON.stringify(p)); } catch { setAviso("Não foi possível conferir ou guardar tentativa; nada enviado."); return; } setPendente(p);trava.current=true;envio.mutate(p); };
  const fotografia=JSON.stringify({clienteId,retornoId,conferenciaId,evidencias,decisao,historicoCompleto,justificativa:justificativa.trim()});
  if (permissao.isPending || permissao.isFetching) return <p>Verificando autorização…</p>;
  if (permissao.isError) return <p role="alert">Autorização indisponível. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (!permitido) return null;
  const atomico = import.meta.env.VITE_SSO_APROVACAO_FINALIZACAO_ATOMICA_ENABLED === "true";
  return <section aria-label="Atestação e aprovação PCM"><h5>Atestar e aprovar retorno</h5><p>O PCM confirma a revisão; o servidor revalida requisitos de resposta/evidência e prepara pendências Não OK. Isso não autentica conteúdo nem chama Auvo.</p>
    {!historicoCompleto && <p>Histórico não reconciliado; operação bloqueada.</p>}
    {atomico && !pendente ? <AprovarFinalizarAtomico userId={userId} clienteId={clienteId} retornoId={retornoId} conferenciaId={conferenciaId} evidencias={evidencias} decisao={decisao} historicoCompleto={historicoCompleto} /> : !atomico && <form onSubmit={(e) => { e.preventDefault(); if (pendente || confirmado!==fotografia || !historicoCompleto || !justificativa.trim()) return; enviar({ requestId: crypto.randomUUID(), clienteId, retornoId, conferenciaId, evidencias, decisao, justificativa: justificativa.trim() }); }}>
      <fieldset disabled={!!pendente || envio.isPending || !historicoCompleto}><label>Justificativa <textarea required maxLength={2000} value={justificativa} onChange={(e) => {setJustificativa(e.target.value);setConfirmado(null);}} /></label>{" "}
      {confirmado&&confirmado!==fotografia&&<p role="alert">Revisões alteradas; confira novamente.</p>}
      <label><input type="checkbox" checked={confirmado===fotografia} onChange={(e) => setConfirmado(e.target.checked?fotografia:null)} /> Conferi o retorno e autorizo a decisão de aprovação PCM</label><button type="submit" disabled={confirmado!==fotografia}>Atestar e aprovar retorno</button></fieldset>
    </form>}
    {historico.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
    {historico.data && !historico.isFetching && !historico.isError && <ul>{historico.data.pages.flat().map((r) => <li key={r.request_id}>Decisão {r.decisao_id} · revisão {r.revisao_decisao} · {r.justificativa} · {r.ator_id} · {r.criado_em}
      {import.meta.env.VITE_SSO_FINALIZAR_OS_VALIDADA_ENABLED === "true" && <FinalizarOsValidada userId={userId} clienteId={clienteId} retornoId={retornoId} atestacaoId={r.request_id} decisaoRevision={r.revisao_decisao} />}</li>)}</ul>}{historico.hasNextPage && <button type="button" onClick={() => void historico.fetchNextPage()}>Mais histórico</button>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente,true)}>Repetir tentativa pendente</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
