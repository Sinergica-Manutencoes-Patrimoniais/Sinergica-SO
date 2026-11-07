import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const pedido = z.object({ requestId: z.string().guid(), publicacaoId: z.string().guid() }).strict();
type Pedido = z.infer<typeof pedido>;
export function ConfirmacaoVisita({ userId, clienteId, osId, publicacaoId }: { userId: string; clienteId: string; osId: string; publicacaoId: string }) {
  const chave = `sso-confirmacao-cliente:${JSON.stringify([userId, clienteId, osId, publicacaoId])}`; const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.publicacaoId === publicacaoId ? p : "invalido"; } catch { return "invalido"; } });
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const consulta = useQuery({ queryKey: ["portal-confirmacao-visita", userId, clienteId, osId, publicacaoId], gcTime: 0, staleTime: 0,
    retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_portal_status_confirmacao_visita", { p_publicacao_id: publicacaoId }).abortSignal(signal);
      if (error) throw error; return z.enum(["pendente", "confirmada", "nao_exigida", "desatualizada"]).parse(data); } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const { data, error } = await supabase.schema("pcm").rpc("sso_portal_confirmar_visita", { p_request_id: p.requestId, p_publicacao_id: p.publicacaoId });
    if (error) throw error; return z.string().datetime({ offset: true }).parse(data); }, onSuccess: async (_r, p) => {
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Confirmação registrada; a equipe ainda verifica o envio das tarefas."); await cache.invalidateQueries({ queryKey: ["portal-confirmacao-visita", userId, clienteId, osId, publicacaoId] });
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte a equipe."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current || consulta.isFetching || consulta.isError) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || enviando.current || consulta.isFetching || consulta.isError || consulta.data !== "pendente") return; try {
    const p = pedido.parse({ requestId: crypto.randomUUID(), publicacaoId }); if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente");
    sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Não foi possível guardar o pedido; nada foi enviado."); } }
  return <section aria-label="Confirmação do Cliente para a visita">
    {consulta.isFetching && <p>Consultando necessidade de confirmação…</p>}
    {consulta.isError && <p role="alert">Confirmação indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data === "nao_exigida" && <p>Confirmação do Cliente não exigida para esta visita.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data === "desatualizada" && <p>Programação ou política desatualizada; consulte a equipe.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data === "confirmada" && <p>Confirmação do Cliente registrada para esta programação.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data === "pendente" && <p>Esta programação exige confirmação do Cliente. Confirmar é diferente de registrar ciência informativa.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte a equipe.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending || consulta.isFetching || consulta.isError} onClick={() => enviar(pendente)}>Repetir confirmação</button> :
      !pendente && consulta.data === "pendente" && !consulta.isFetching && !consulta.isError && <button type="button" disabled={comando.isPending} onClick={iniciar}>Confirmar esta programação</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
