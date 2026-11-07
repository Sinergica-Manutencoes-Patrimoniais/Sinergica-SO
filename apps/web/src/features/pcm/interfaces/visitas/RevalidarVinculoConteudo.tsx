import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const previa = z.object({ osId: z.string().guid(), ocorrenciaLegadaId: z.string().guid(), ocorrenciaPreparadaId: z.string().guid(), planoId: z.string().guid(),
  versaoId: z.string().guid(), rotinaId: z.string().guid(), alvoTipo: z.enum(["sistema", "componente", "grupo"]), alvoId: z.string().guid() }).strict();
const pedido = z.object({ requestId: z.string().guid(), visitaId: z.string().guid(), osId: z.string().guid(), revisaoVisita: z.number().int().positive(),
  revisaoVinculo: z.number().int().positive(), previa }).strict(); type Pedido = z.infer<typeof pedido>;
export function RevalidarVinculoConteudo({ userId, clienteId, visitaId, osId, revisao, bloqueado }: { userId: string; clienteId: string; visitaId: string; osId: string; revisao: number; bloqueado: boolean }) {
  const chave = `sso-revalidar-vinculo:${JSON.stringify([userId, clienteId, visitaId, osId, revisao])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.visitaId === visitaId && p.osId === osId && p.revisaoVisita === revisao ? p : "invalido"; } catch { return "invalido"; } });
  const [confirmado, setConfirmado] = useState(false); const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const consulta = useQuery({ queryKey: ["os-vinculo-conferir", userId, clienteId, visitaId, osId, revisao], enabled: !bloqueado, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const [s, p] = await Promise.all([
        supabase.schema("pcm").rpc("sso_status_vinculo_os_rotina", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal),
        supabase.schema("pcm").rpc("sso_prever_vinculo_os_rotina", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal),
      ]);
      if (s.error) throw s.error; if (p.error) throw p.error;
      const status = z.array(z.object({ revisao: z.number().int().positive(), estado: z.enum(["invalidado", "registrado_nao_revalidado"]) }).strict()).length(1).parse(s.data)[0]!;
      const dados = previa.parse(p.data); if (dados.osId !== osId) throw new Error("Prévia divergente"); return { status, dados };
    } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const { data, error } = await supabase.schema("pcm").rpc("sso_revalidar_vinculo_os_conteudo", {
    p_request_id: p.requestId, p_cliente_id: clienteId, p_visita_id: p.visitaId, p_os_id: p.osId, p_revisao_visita: p.revisaoVisita, p_revisao_vinculo: p.revisaoVinculo, p_previa: p.previa });
    if (error) throw error; const r = z.object({ requestId: z.string().guid(), osId: z.string().guid(), revisaoVinculo: z.number().int().positive(), state: z.literal("vinculo_conferido_sem_envio") }).strict().parse(data);
    if (r.requestId !== p.requestId || r.osId !== osId || r.revisaoVinculo !== p.revisaoVinculo) throw new Error("Resposta divergente");
  }, onSuccess: (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Conferência registrada, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setConfirmado(false); setAviso("Vínculo conferido nesta revisão; não autoriza envio e mudanças posteriores exigem nova conferência.");
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (bloqueado || enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || bloqueado || enviando.current || consulta.isFetching || consulta.isError || !consulta.data || consulta.data.status.estado === "invalidado" || !confirmado) return; try {
    const p = pedido.parse({ requestId: crypto.randomUUID(), visitaId, osId, revisaoVisita: revisao, revisaoVinculo: consulta.data.status.revisao, previa: consulta.data.dados });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Não foi possível guardar o pedido; nada foi enviado."); } }
  return <section><p>Conferência do vínculo OS–Rotina não substitui revisão de questionário, escopo ou equipe.</p>
    {consulta.isFetching && <p>Consultando cadeia…</p>}{consulta.isError && <p role="alert">Cadeia indisponível ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <div><p>Vínculo revisão {consulta.data.status.revisao} · {consulta.data.status.estado === "invalidado" ? "invalidado" : "registrado"} · Rotina {consulta.data.dados.rotinaId} · alvo {consulta.data.dados.alvoTipo} {consulta.data.dados.alvoId}.</p>
      <label><input type="checkbox" checked={confirmado} disabled={!!pendente || comando.isPending || consulta.data.status.estado === "invalidado"} onChange={(e) => setConfirmado(e.target.checked)} /> Conferi esta cadeia.</label></div>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={bloqueado || comando.isPending} onClick={() => enviar(pendente)}>Repetir conferência</button> :
      !pendente && <button type="button" disabled={bloqueado || comando.isPending || !confirmado || consulta.isFetching || consulta.isError || !consulta.data || consulta.data.status.estado === "invalidado"} onClick={iniciar}>Revalidar vínculo</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
