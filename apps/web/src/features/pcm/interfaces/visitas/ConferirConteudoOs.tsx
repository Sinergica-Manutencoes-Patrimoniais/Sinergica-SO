import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { DiagnosticoConteudoOs } from "./DiagnosticoConteudoOs";
import { RevalidarVinculoConteudo } from "./RevalidarVinculoConteudo";

const snapshot = z.object({ id: z.string().uuid(), clienteId: z.string().uuid(), numero: z.string(), titulo: z.string(), descricao: z.string().nullable(),
  categoria: z.string(), status: z.string(), prioridade: z.string(), localDescricao: z.string().nullable(), excluidaEm: z.string().nullable(),
  equipamentoId:z.string().uuid().nullable().optional(),tipoTarefaId:z.string().uuid().nullable().optional(),tecnicoFuncionarioId:z.string().uuid().nullable().optional(),
  sistemaId:z.string().uuid().nullable().optional(),questionarioId:z.string().uuid().nullable().optional() }).strict();
const previa = z.object({ visitaId: z.string().uuid(), visitaRevision: z.number().int().positive(), osId: z.string().uuid(), geracao: z.number().int().positive().safe(), snapshot }).strict();
const pedido = previa.extend({ requestId: z.string().uuid() }).strict();
type Pedido = z.infer<typeof pedido>;
export function ConferirConteudoOs({ userId, clienteId, visitaId, osId, revisao, bloqueado }: { userId: string; clienteId: string; visitaId: string; osId: string; revisao: number; bloqueado: boolean }) {
  const chave = `sso-conferir-conteudo-os:${JSON.stringify([userId, clienteId, visitaId, osId, revisao])}`;
  const cache=useQueryClient();
  const [aberto, setAberto] = useState(false); const [confirmado, setConfirmado] = useState<string|null>(null); const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.visitaId === visitaId && p.osId === osId && p.visitaRevision === revisao && p.snapshot.clienteId === clienteId ? p : "invalido"; } catch { return "invalido"; } });
  const consulta = useQuery({ queryKey: ["visitas", userId, clienteId, visitaId, "conteudo-os", osId, revisao], enabled: aberto && !bloqueado,
    gcTime: 0, staleTime: 0, retry: false, queryFn: async ({ signal }) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_prever_conteudo_os", { p_cliente_id: clienteId, p_visita_id: visitaId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; const p = previa.parse(data); if (p.visitaId !== visitaId || p.osId !== osId || p.visitaRevision !== revisao || p.snapshot.clienteId !== clienteId) throw new Error("Prévia divergente");
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return p; } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou pedido alterado.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_conteudo_os", {
    p_request_id: p.requestId, p_cliente_id: clienteId, p_visita_id: p.visitaId, p_os_id: p.osId, p_visita_revision: p.visitaRevision, p_geracao: p.geracao, p_snapshot: p.snapshot });
    if (error) throw error; const r = z.object({ requestId: z.string().uuid(), geracao: z.number().int().positive(), visitaRevision: z.number().int().positive(), state: z.literal("conferida_basica") }).strict().parse(data);
    if (r.requestId !== p.requestId || r.geracao !== p.geracao || r.visitaRevision !== p.visitaRevision) throw new Error("Resposta divergente");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");
  }, onSuccess: async (_r, p) => { try { await cache.invalidateQueries({queryKey:["visitas",userId,clienteId,visitaId,"conteudo-os",osId]});
    const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Sessão ou pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setConfirmado(null); setAviso("Campos básicos conferidos. Confirmação PCM e revisão completa permanecem necessárias.");
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (bloqueado || enviando.current) return; try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();}catch{setAviso("Pedido local divergente. Preserve a tentativa e consulte suporte.");return;} enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || bloqueado || enviando.current || consulta.isFetching || consulta.isError || !consulta.data || confirmado !== JSON.stringify(consulta.data)) return; try {
    const p = pedido.parse({ ...consulta.data, requestId: crypto.randomUUID() }); if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente");
    sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Não foi possível guardar o pedido; nada foi enviado."); } }
  return <section><button type="button" disabled={bloqueado} onClick={() => { setAberto((v) => !v); setConfirmado(null); }}>{aberto ? "Ocultar prévia da OS" : "Conferir conteúdo básico da OS"}</button>
    {aberto && <><p>Esta conferência não abrange alvo, questionário, escopo, equipe nem autoriza envio.</p>
      {import.meta.env.VITE_SSO_DIAGNOSTICO_CONTEUDO_OS_ENABLED === "true" && <DiagnosticoConteudoOs userId={userId} clienteId={clienteId} visitaId={visitaId} osId={osId} revisao={revisao} />}
      {import.meta.env.VITE_SSO_REVALIDAR_VINCULO_CONTEUDO_ENABLED === "true" && <RevalidarVinculoConteudo userId={userId} clienteId={clienteId} visitaId={visitaId} osId={osId} revisao={revisao} bloqueado={bloqueado} />}
      {consulta.isFetching && <p>Consultando prévia…</p>}{consulta.isError && <p role="alert">Prévia indisponível ou desatualizada. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && consulta.data && <div><p>{consulta.data.snapshot.numero} · {consulta.data.snapshot.titulo} · {consulta.data.snapshot.categoria} · {consulta.data.snapshot.status} · prioridade {consulta.data.snapshot.prioridade}</p>
        <p>Descrição: {consulta.data.snapshot.descricao ?? "não informada"}</p><p>Local: {consulta.data.snapshot.localDescricao ?? "não informado"}</p>
        {consulta.data.snapshot.equipamentoId!==undefined&&<p>Equipamento: {consulta.data.snapshot.equipamentoId ?? "não informado"} · Tipo de tarefa: {consulta.data.snapshot.tipoTarefaId ?? "não informado"} · Técnico da OS: {consulta.data.snapshot.tecnicoFuncionarioId ?? "não informado"}.</p>}
        {consulta.data.snapshot.sistemaId!==undefined&&<p>Sistema: {consulta.data.snapshot.sistemaId ?? "não informado"} · Questionário da OS: {consulta.data.snapshot.questionarioId ?? "não informado"}.</p>}
        <label><input type="checkbox" checked={confirmado===JSON.stringify(consulta.data)} disabled={!!pendente || comando.isPending} onChange={(e) => setConfirmado(e.target.checked?JSON.stringify(consulta.data):null)} /> Revisei estes campos básicos para a Visita planejada.</label></div>}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" ? <button type="button" disabled={bloqueado || comando.isPending} onClick={() => enviar(pendente)}>Repetir revisão</button> :
        !pendente && <button type="button" disabled={bloqueado || comando.isPending || !consulta.data || confirmado !== JSON.stringify(consulta.data) || consulta.isFetching || consulta.isError} onClick={iniciar}>Registrar revisão básica</button>}
      {aviso && <p role="status">{aviso}</p>}</>}
  </section>;
}
