import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const previa = z.object({ osId: z.string().uuid(), ocorrenciaLegadaId: z.string().uuid(), ocorrenciaPreparadaId: z.string().uuid(),
  planoId: z.string().uuid(), versaoId: z.string().uuid(), rotinaId: z.string().uuid(), alvoTipo: z.enum(["sistema", "componente", "grupo"]), alvoId: z.string().uuid() }).strict();
const pedido = z.object({ requestId: z.string().uuid(), previa }).strict(); type Pedido = z.infer<typeof pedido>;
export function VincularOsRotina({ userId, clienteId, osId, bloqueado }: { userId: string; clienteId: string; osId: string; bloqueado: boolean }) {
  const chave = `sso-os-rotina:${JSON.stringify([userId, clienteId, osId])}`; const [aberto, setAberto] = useState(false); const [confirmado, setConfirmado] = useState(false);
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.previa.osId === osId ? p : "invalido"; } catch { return "invalido"; } });
  const consulta = useQuery({ queryKey: ["os-rotina-previa", userId, clienteId, osId], enabled: aberto && !bloqueado, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_prever_vinculo_os_rotina", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; const p = previa.parse(data); if (p.osId !== osId) throw new Error("Prévia divergente"); return p; } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const { data, error } = await supabase.schema("pcm").rpc("sso_vincular_os_rotina", {
    p_request_id: p.requestId, p_cliente_id: clienteId, p_os_id: osId, p_previa: p.previa });
    if (error) throw error; const r = z.object({ requestId: z.string().uuid(), osId: z.string().uuid(), state: z.literal("vinculado") }).strict().parse(data);
    if (r.requestId !== p.requestId || r.osId !== osId) throw new Error("Resposta divergente");
  }, onSuccess: (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Vínculo registrado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Vínculo registrado; revisão integral e envio continuam bloqueados.");
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (bloqueado || enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || bloqueado || enviando.current || consulta.isFetching || consulta.isError || !consulta.data || !confirmado) return; try {
    const p = pedido.parse({ requestId: crypto.randomUUID(), previa: consulta.data }); if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente");
    sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Não foi possível guardar pedido; nada foi enviado."); } }
  return <section><button type="button" disabled={bloqueado} onClick={() => { setAberto((v) => !v); setConfirmado(false); }}>{aberto ? "Ocultar origem da Rotina" : "Conferir origem da Rotina"}</button>
    {aberto && <><p>Somente cadeias existentes e comprovadas podem ser vinculadas. Isto não cria ocorrência ou tarefa.</p>
      {consulta.isFetching && <p>Consultando origem…</p>}{consulta.isError && <p role="alert">Cadeia não comprovada ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && consulta.data && <div><p>Ocorrência {consulta.data.ocorrenciaPreparadaId} · Plano {consulta.data.planoId} · versão {consulta.data.versaoId} · Rotina {consulta.data.rotinaId}</p>
        <p>Alvo {consulta.data.alvoTipo} · {consulta.data.alvoId}</p><label><input type="checkbox" checked={confirmado} disabled={!!pendente || comando.isPending} onChange={(e) => setConfirmado(e.target.checked)} /> Conferi esta cadeia de origem.</label></div>}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" ? <button type="button" disabled={bloqueado || comando.isPending} onClick={() => enviar(pendente)}>Repetir vínculo</button> :
        !pendente && <button type="button" disabled={bloqueado || comando.isPending || !confirmado || consulta.isFetching || consulta.isError || !consulta.data} onClick={iniciar}>Registrar vínculo</button>}
      {aviso && <p role="status">{aviso}</p>}</>}
  </section>;
}
