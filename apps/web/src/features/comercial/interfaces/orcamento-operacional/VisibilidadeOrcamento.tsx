import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const evento = z.object({ situacao: z.enum(["publicar", "retirar", "republicar"]), sequencia: z.number().int().positive().nullable(),
  acao: z.enum(["retirar", "republicar"]).nullable(), motivo: z.string().nullable(), ator_id: z.string().uuid().nullable(), criado_em: z.string().nullable() }).strict();
const pedido = z.object({ requestId: z.string().uuid(), propostaId: z.string().uuid(), versao: z.number().int().positive(), acao: z.enum(["retirar", "republicar"]), motivo: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedido>;
export function VisibilidadeOrcamento({ usuario, cliente, propostaId, versao }: { usuario: string; cliente: string; propostaId: string; versao: number }) {
  const chave = `sso-visibilidade-orcamento:${JSON.stringify([usuario, cliente, propostaId, versao])}`; const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.propostaId === propostaId && p.versao === versao ? p : "invalido"; } catch { return "invalido"; } });
  const [motivo, setMotivo] = useState(""); const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const raiz = ["visibilidade-orcamento", usuario, cliente, propostaId, versao];
  const consulta = useQuery({ queryKey: raiz, gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("comercial").rpc("sso_consultar_visibilidade_orcamento", { p_proposta_id: propostaId, p_versao: versao }).abortSignal(signal);
      if (error) throw error; return z.array(evento).min(1).max(20).parse(data); } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const { data, error } = await supabase.schema("comercial").rpc("sso_visibilidade_orcamento", {
    p_request_id: p.requestId, p_proposta_id: p.propostaId, p_versao: p.versao, p_acao: p.acao, p_motivo: p.motivo });
    if (error) throw error; return z.number().int().positive().parse(data);
  }, onSuccess: async (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Visibilidade atualizada; nenhuma tarefa externa foi enviada."); await cache.invalidateQueries({ queryKey: raiz });
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || enviando.current || consulta.isFetching || consulta.isError || !consulta.data?.length) return; try {
    const p = pedido.parse({ requestId: crypto.randomUUID(), propostaId, versao, acao: consulta.data[0]!.situacao === "retirar" ? "republicar" : "retirar", motivo: motivo.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira o motivo e a sessão. Nada foi enviado."); } }
  return <section><h5>Visibilidade no Portal</h5><p>Republicar apresenta exatamente a mesma versão; editar conteúdo exige nova revisão.</p>
    {consulta.isFetching && <p>Consultando visibilidade…</p>}{consulta.isError && <p role="alert">Visibilidade indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <p>Situação: {consulta.data[0]!.situacao === "retirar" ? "retirada" : "publicada"}.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button> :
      !pendente && !consulta.isFetching && !consulta.isError && consulta.data && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Motivo <input required maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <button type="submit" disabled={comando.isPending}>{consulta.data[0]!.situacao === "retirar" ? "Republicar" : "Retirar"}</button></form>}
    {aviso && <p role="status">{aviso}</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.filter((e) => e.sequencia !== null).map((e) => <p key={e.sequencia}>{e.acao} · {e.criado_em && new Date(e.criado_em).toLocaleString("pt-BR")} · {e.ator_id} · {e.motivo}</p>)}
    {consulta.data?.length === 20 && <p>Exibindo até os 20 eventos mais recentes.</p>}
  </section>;
}
