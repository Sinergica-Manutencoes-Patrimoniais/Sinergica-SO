import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Pedido = { requestId: string; clienteId: string; retornoId: string; respostaId: string; evidenciaId: string; decisaoRevision: number; uploadsRevision: number; decisao: "aceita_pcm" | "rejeitada_pcm"; justificativa: string };
const pedidoSchema=z.object({requestId:z.string().uuid(),clienteId:z.string().uuid(),retornoId:z.string().uuid(),respostaId:z.string().uuid(),evidenciaId:z.string().uuid(),decisaoRevision:z.number().int().nonnegative().safe(),uploadsRevision:z.number().int().positive().safe(),decisao:z.enum(["aceita_pcm","rejeitada_pcm"]),justificativa:z.string().trim().min(1).max(2000)}).strict();
const historicoSchema = z.object({ id: z.string().uuid(), evidencia_id: z.string().uuid(), revisao: z.number().int().positive().safe(), revisao_uploads: z.number().int().positive().safe(), decisao: z.enum(["aceita_pcm", "rejeitada_pcm"]), justificativa: z.string(), ator_id: z.string().uuid(), criado_em: z.string() }).strict();

export function ValidacaoResposta({ userId, clienteId, retornoId, respostaId, evidenciaId, uploadsRevision }: { userId: string; clienteId: string; retornoId: string; respostaId: string; evidenciaId: string; uploadsRevision: number }) {
  const cache = useQueryClient(); const storageKey = `sso-validacao-resposta:${JSON.stringify([userId, clienteId, retornoId, respostaId, evidenciaId])}`;
  const enviando = useRef(false);
  const [decisao, setDecisao] = useState<Pedido["decisao"]>("rejeitada_pcm"); const [justificativa, setJustificativa] = useState(""); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw));
    return p.clienteId === clienteId && p.retornoId === retornoId && p.respostaId === respostaId && p.evidenciaId === evidenciaId ? p : "invalido";
  } catch { return "invalido"; } });
  const historico = useInfiniteQuery({ queryKey: ["retorno-validacoes-resposta", userId, clienteId, retornoId, respostaId], gcTime: 0, initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => { const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");const { data, error } = await supabase.schema("pcm").rpc("sso_listar_validacoes_resposta_mediada", { p_cliente_id: clienteId, p_retorno_id: retornoId, p_resposta_id: respostaId, p_antes: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error;
      const pagina = z.array(historicoSchema).max(20).parse(data); let anterior = pageParam ?? Number.MAX_SAFE_INTEGER;
      for (const item of pagina) { if (item.revisao >= anterior) throw new Error("Histórico inválido."); anterior = item.revisao; } const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");return pagina;
    }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.revisao : undefined });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==userId || sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error("Sessão ou tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_validar_resposta_evidencia_mediada", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_retorno_id: p.retornoId, p_resposta_id: p.respostaId, p_evidencia_id: p.evidenciaId, p_expected_decisao: p.decisaoRevision, p_expected_uploads: p.uploadsRevision, p_decisao: p.decisao, p_justificativa: p.justificativa });
    if (error) throw error;
    const recibo = z.object({ validacaoId: z.string().uuid(), revision: z.number().int().positive().safe(), requestId: z.string().uuid(), conteudoAutenticado: z.literal(false) }).strict().parse(data);
    if (recibo.requestId !== p.requestId || recibo.revision !== p.decisaoRevision + 1) throw new Error("Recibo divergente.");
    const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==userId)throw new Error("Sessão alterada.");
  }, onSuccess: async (_resultado, p) => {
    await cache.invalidateQueries({ queryKey: ["retorno-validacoes-resposta", userId, clienteId, retornoId, respostaId] });
    try { const atual=await supabase.auth.getUser();if(atual.error || atual.data.user?.id!==userId || sessionStorage.getItem(storageKey) !== JSON.stringify(p)) { setAviso("Sessão ou tentativa mudou. Procure suporte; tentativa preservada."); return; } sessionStorage.removeItem(storageKey); }
    catch { setAviso("Tentativa local não pôde ser removida; procure suporte."); return; }
    setPendente(null); setAviso("Decisão humana registrada; conteúdo não foi autenticado e OS não foi encerrada.");
  }, onError: () => setAviso("Resultado não confirmado, evidência ou revisão pode ter mudado. Repita a mesma tentativa; procure suporte em conflito."), onSettled: () => { enviando.current = false; } });
  const enviar = (p: Pedido) => { if (enviando.current) return; try { pedidoSchema.parse(p);const salvo = sessionStorage.getItem(storageKey); const novo = JSON.stringify(p); if ((salvo !== null && salvo !== novo) || (salvo === null && pendente)) throw new Error("Tentativa divergente."); if(salvo===null)sessionStorage.setItem(storageKey, novo); } catch { setAviso("Não foi possível guardar tentativa; nada enviado."); return; } enviando.current = true; setPendente(p); envio.mutate(p); };
  const revision = historico.data?.pages[0]?.[0]?.revisao ?? 0;
  return <section aria-label="Decisão de resposta e evidência"><p>Decisão humana para esta resposta e foto. Não autentica conteúdo, autoria de campo ou execução; não aprova retorno nem encerra OS.</p>
    {historico.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || !historico.data || historico.isFetching || historico.isError || !justificativa.trim() || uploadsRevision < 1) return; enviar({ requestId: crypto.randomUUID(), clienteId, retornoId, respostaId, evidenciaId, decisaoRevision: revision, uploadsRevision, decisao, justificativa: justificativa.trim() }); }}>
      <fieldset disabled={!!pendente || envio.isPending || !historico.data || historico.isFetching || historico.isError}><label>Decisão <select value={decisao} onChange={(e) => setDecisao(e.target.value as Pedido["decisao"])}><option value="rejeitada_pcm">Rejeitar</option><option value="aceita_pcm">Aceitar pelo PCM</option></select></label>{" "}
      <label>Motivo <textarea required maxLength={2000} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} /></label><button type="submit">Registrar decisão</button></fieldset>
    </form>
    {!historico.isFetching && !historico.isError && historico.data && <ul>{historico.data.pages.flat().map((d) => <li key={d.id}>Revisão {d.revisao} · {d.decisao} · evidência {d.evidencia_id} · uploads {d.revisao_uploads} · {d.justificativa} · {d.ator_id} · {d.criado_em}</li>)}</ul>}{historico.hasNextPage && !historico.isError && <button type="button" disabled={historico.isFetching} onClick={() => void historico.fetchNextPage()}>Mais histórico</button>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
