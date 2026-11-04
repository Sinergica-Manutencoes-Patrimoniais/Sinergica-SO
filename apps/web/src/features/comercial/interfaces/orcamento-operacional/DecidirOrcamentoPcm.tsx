import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const pedido = z.object({ requestId: uuid, cliente: uuid, os: uuid, proposta: uuid, versao: z.number().int().positive(), decisao: z.enum(["aceita", "recusada"]), motivo: z.string().min(1).max(2000), evidencia: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedido>;
export function DecidirOrcamentoPcm({ usuario, cliente, os, proposta, versao, status }: { usuario: string; cliente: string; os: string; proposta: string; versao: number; status: string }) {
 return <Conteudo key={JSON.stringify([usuario,cliente,os,proposta])} usuario={usuario} cliente={cliente} os={os} proposta={proposta} versao={versao} status={status}/>;
}
function Conteudo({ usuario, cliente, os, proposta, versao, status }: { usuario: string; cliente: string; os: string; proposta: string; versao: number; status: string }) {
 const chave = `decisao-pcm-orcamento:${JSON.stringify([usuario, cliente, os, proposta])}`; const cache = useQueryClient(); const ocupado = useRef(false);
 const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedido.parse(JSON.parse(raw)); return p.cliente === cliente && p.os === os && p.proposta === proposta ? p : "invalido"; } catch { return "invalido"; } });
 const [decisao, setDecisao] = useState<Pedido["decisao"]>("aceita"); const [motivo, setMotivo] = useState(""); const [evidencia, setEvidencia] = useState(""); const [confirmado, setConfirmado] = useState<string | null>(null); const [aviso, setAviso] = useState("");
 const fotografia=JSON.stringify({usuario,cliente,os,proposta,versao,status,decisao,motivo,evidencia});
 const consulta = useQuery({ queryKey: ["decisao-pcm-orcamento", usuario, cliente, os, proposta, versao], gcTime: 0, retry: false, queryFn: async ({ signal }) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");const { data, error } = await supabase.schema("comercial").rpc("sso_consultar_decisao_pcm_orcamento", { p_cliente_id: cliente, p_os_id: os, p_proposta_id: proposta, p_versao: versao }).abortSignal(signal); if (error) throw error; const pagina=z.array(z.object({ decisao: z.enum(["aceita", "recusada"]), ator_id: uuid, criado_em: z.string() }).strict()).max(1).parse(data);const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina; } });
 const enviar = async (p: Pedido) => {
   if (ocupado.current) return;
   ocupado.current = true;
   try {
     const antes=await supabase.auth.getUser();
     if (antes.error || antes.data.user?.id!==usuario || sessionStorage.getItem(chave) !== JSON.stringify(p)) {
       setAviso("Tentativa local alterada ou indisponível. Procure suporte antes de repetir.");
       return;
     }
     const { data, error } = await supabase.schema("comercial").rpc("sso_decidir_orcamento_pcm", { p_request_id: p.requestId, p_cliente_id: p.cliente, p_os_id: p.os, p_proposta_id: p.proposta, p_versao: p.versao, p_decisao: p.decisao, p_motivo: p.motivo, p_evidencia: p.evidencia });
     if (error) throw error;
     const r = z.object({ requestId: uuid, propostaId: uuid, osId: uuid, versao: z.number().int().positive(), decisao: z.enum(["aceita", "recusada"]), evidenciaAutenticada: z.literal(false), osCriada: z.literal(false), cobrancaCriada: z.literal(false) }).strict().parse(data);
     if (r.requestId !== p.requestId || r.propostaId !== p.proposta || r.osId !== p.os || r.versao !== p.versao || r.decisao !== p.decisao) throw new Error("Resposta divergente");
     const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario)throw new Error("Sessão alterada.");
     await cache.invalidateQueries({ queryKey: ["decisao-pcm-orcamento", usuario, cliente, os, proposta] });
     await cache.invalidateQueries({ queryKey: ["orcamentos-operacionais", usuario, cliente, os] });
     const atual=await supabase.auth.getUser();
     if (atual.error || atual.data.user?.id!==usuario || sessionStorage.getItem(chave) !== JSON.stringify(p)) {
       setAviso("Decisão confirmada, mas a tentativa local mudou. Procure suporte; o registro local foi preservado.");
       return;
     }
     sessionStorage.removeItem(chave);
     setPendente(null); setConfirmado(null);
     setAviso("Decisão PCM registrada. A referência de evidência não foi autenticada; não é aceite direto do Cliente.");
   } catch {
     setAviso("Resultado não confirmado, versão mudou ou não há autorização. Repita o mesmo pedido ou procure suporte.");
   } finally { ocupado.current = false; }
 };
 return <section><h4>Decisão interna PCM</h4><p>Esta é uma decisão do PCM sobre a versão publicada. A evidência é uma referência declarada, não autenticada: não representa aceite direto do Cliente. Não cria OS, tarefa ou cobrança.</p>
 {consulta.isError && <p role="alert">Decisão interna indisponível ou sem autorização. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}{consulta.data?.map((x) => <p key={x.ator_id}>Decisão PCM {x.decisao}, por {x.ator_id} em {new Date(x.criado_em).toLocaleString("pt-BR")}; não é aceite direto do Cliente.</p>)}
 {status === "enviada" && !pendente && consulta.data?.length === 0 && !consulta.isFetching && !consulta.isError && <form onSubmit={(e) => { e.preventDefault(); if (!motivo.trim() || !evidencia.trim() || confirmado !== fotografia || ocupado.current) return; const p = pedido.parse({ requestId: crypto.randomUUID(), cliente, os, proposta, versao, decisao, motivo: motivo.trim(), evidencia: evidencia.trim() }); try { if (sessionStorage.getItem(chave)) return; sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setAviso("Não foi possível guardar tentativa; nada enviado."); return; } setPendente(p); void enviar(p); }}><label>Decisão PCM <select value={decisao} onChange={(e) => { setDecisao(e.target.value as Pedido["decisao"]); setConfirmado(null); }}><option value="aceita">Aceitar internamente</option><option value="recusada">Recusar internamente</option></select></label><label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label><label>Referência de evidência declarada <textarea required maxLength={1000} value={evidencia} onChange={(e) => setEvidencia(e.target.value)} /></label><label><input type="checkbox" checked={confirmado === fotografia} onChange={(e) => setConfirmado(e.target.checked ? fotografia : null)} /> Confirmo a decisão PCM da versão {versao}; não afirmo aceite autenticado do Cliente.</label><button type="submit" disabled={confirmado !== fotografia}>Registrar decisão PCM</button></form>}
 {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" onClick={() => void enviar(pendente)}>Repetir mesma tentativa</button>}{aviso && <p role="status">{aviso}</p>}</section>;
}
