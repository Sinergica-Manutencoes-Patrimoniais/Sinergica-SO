import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const previa = z.object({ osId: z.string().guid(), ocorrenciaLegadaId: z.string().guid(), ocorrenciaPreparadaId: z.string().guid(), planoId: z.string().guid(),
  versaoId: z.string().guid(), rotinaId: z.string().guid(), alvoTipo: z.enum(["sistema", "componente", "grupo"]), alvoId: z.string().guid() }).strict();
const pedido = z.object({ requestId: z.string().guid(), osId: z.string().guid(), revisao: z.number().int().positive(), acao: z.enum(["invalidar", "retificar"]), motivo: z.string().min(1).max(1000), previa: previa.nullable() }).strict()
  .refine((p) => p.acao === "invalidar" ? p.previa === null : p.previa !== null);
type Pedido = z.infer<typeof pedido>;
const evento = z.object({ revisao: z.number().int().positive(), acao: z.enum(["base", "invalidar", "retificar"]), motivo: z.string().nullable(), ator_id: z.string().guid(), criado_em: z.string(), previa: previa.nullable() }).strict();
export function RetificarOsRotina({ userId, clienteId, osId, bloqueado }: { userId: string; clienteId: string; osId: string; bloqueado: boolean }) {
  const chave = `sso-retificar-os-rotina:${JSON.stringify([userId, clienteId, osId])}`; const cache = useQueryClient();
  const [aberto, setAberto] = useState(false); const [motivo, setMotivo] = useState(""); const [confirmado, setConfirmado] = useState(false); const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.osId === osId ? p : "invalido"; } catch { return "invalido"; } });
  const raiz = ["retificar-os-rotina", userId, clienteId, osId];
  const status = useQuery({ queryKey: [...raiz, "status"], enabled: aberto && !bloqueado, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_status_vinculo_os_rotina", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; return z.array(z.object({ revisao: z.number().int().positive(), estado: z.enum(["invalidado", "registrado_nao_revalidado"]) }).strict()).max(1).parse(data)[0] ?? null; } });
  const consulta = useQuery({ queryKey: [...raiz, "previa"], enabled: aberto && !bloqueado && status.data?.estado === "invalidado", gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_prever_vinculo_os_rotina", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; const p = previa.parse(data); if (p.osId !== osId) throw new Error("Prévia divergente"); return p; } });
  const historico = useInfiniteQuery({ queryKey: [...raiz, "historico"], enabled: aberto && !bloqueado && !!status.data, gcTime: 0, staleTime: 0, retry: false,
    initialPageParam: 0, queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_historico_vinculo_os_rotina", { p_cliente_id: clienteId, p_os_id: osId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(evento).max(20).parse(data); }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.revisao : undefined });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const { data, error } = await supabase.schema("pcm").rpc("sso_retificar_vinculo_os_rotina", {
    p_request_id: p.requestId, p_cliente_id: clienteId, p_os_id: p.osId, p_revisao: p.revisao, p_acao: p.acao, p_motivo: p.motivo, p_previa: p.previa });
    if (error) throw error; if (z.number().int().parse(data) !== p.revisao + 1) throw new Error("Resposta divergente");
  }, onSuccess: async (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setConfirmado(false); setAviso("Evento registrado; cadeia precisa ser revalidada no uso."); await cache.invalidateQueries({ queryKey: raiz });
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (bloqueado || enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || bloqueado || enviando.current || status.isFetching || status.isError || !status.data) return; try {
    const acao = status.data.estado === "invalidado" ? "retificar" : "invalidar";
    if (acao === "retificar" && (!confirmado || consulta.isFetching || consulta.isError || !consulta.data)) throw new Error("Prévia não conferida");
    const p = pedido.parse({ requestId: crypto.randomUUID(), osId, revisao: status.data.revisao, acao, motivo: motivo.trim(), previa: acao === "retificar" ? consulta.data : null });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira motivo, prévia e sessão. Nada foi enviado."); } }
  return <section><button type="button" disabled={bloqueado} onClick={() => { setAberto((v) => !v); setConfirmado(false); }}>{aberto ? "Ocultar histórico do vínculo" : "Histórico e retificação do vínculo"}</button>
    {aberto && !bloqueado && <><p>Vínculo registrado não prova que a cadeia continua vigente; alterações não autorizam envio.</p>
      {status.isFetching && <p>Consultando vínculo…</p>}{status.isError && <p role="alert">Vínculo indisponível ou sem acesso. <button type="button" onClick={() => void status.refetch()}>Tentar novamente</button></p>}
      {!status.isFetching && !status.isError && status.data === null && <p>Nenhum vínculo registrado.</p>}
      {status.data && !status.isFetching && !status.isError && <p>Revisão {status.data.revisao} · {status.data.estado === "invalidado" ? "invalidado" : "registrado, ainda não revalidado"}.</p>}
      {status.data?.estado === "invalidado" && consulta.isFetching && <p>Consultando nova cadeia…</p>}{status.data?.estado === "invalidado" && consulta.isError && <p role="alert">Nova cadeia não comprovada. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {status.data?.estado === "invalidado" && !consulta.isFetching && !consulta.isError && consulta.data && <div><p>Rotina {consulta.data.rotinaId} · versão {consulta.data.versaoId} · alvo {consulta.data.alvoTipo} {consulta.data.alvoId}</p>
        <label><input type="checkbox" checked={confirmado} disabled={!!pendente || comando.isPending} onChange={(e) => setConfirmado(e.target.checked)} /> Conferi a nova cadeia.</label></div>}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button> :
        !pendente && status.data && !status.isFetching && !status.isError && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}><label>Motivo <input required maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
          <button type="submit" disabled={comando.isPending || (status.data.estado === "invalidado" && (!confirmado || consulta.isFetching || consulta.isError || !consulta.data))}>{status.data.estado === "invalidado" ? "Retificar" : "Invalidar"}</button></form>}
      {aviso && <p role="status">{aviso}</p>}{historico.isFetching && <p>Consultando histórico…</p>}{historico.isError && <p role="alert">Histórico indisponível.</p>}
      {!historico.isError && historico.data?.pages.flat().map((e) => <p key={e.revisao}>Revisão {e.revisao} · {e.acao} · {new Date(e.criado_em).toLocaleString("pt-BR")} · {e.ator_id}{e.motivo ? ` · ${e.motivo}` : ""}{e.previa ? ` · Rotina ${e.previa.rotinaId} · versão ${e.previa.versaoId}` : ""}</p>)}
      {!historico.isError && historico.hasNextPage && <button type="button" onClick={() => void historico.fetchNextPage()}>Mais eventos</button>}</>}
  </section>;
}
