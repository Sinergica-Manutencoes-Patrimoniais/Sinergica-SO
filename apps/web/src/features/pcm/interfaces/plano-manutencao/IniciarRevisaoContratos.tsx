import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
type Pedido = { requestId: string; clienteId: string; planoId: string; revision: number; versaoId: string; modo: "contratos" | "evidencias" | "exigencias" };

export function IniciarRevisaoContratos({ userId, clienteId, planoId, revision, permitirNova = true }: { userId: string; clienteId: string; planoId: string; revision: number; permitirNova?: boolean }) {
  const cache = useQueryClient(); const storageKey = `sso-revisao-contratos:${JSON.stringify([userId, clienteId, planoId])}`;
  const trava = useRef(false);
  const mediada = import.meta.env.VITE_SSO_REVISAO_CONTRATOS_MEDIADA_ENABLED === "true";
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada.");
  }
  const modo = import.meta.env.VITE_SSO_REVISAO_COM_EXIGENCIAS_ENABLED === "true" ? "exigencias" : import.meta.env.VITE_SSO_REVISAO_COM_EVIDENCIAS_ENABLED === "true" ? "evidencias" : "contratos";
  const [confirmado, setConfirmado] = useState(false); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as Pedido;
    return p.clienteId === clienteId && p.planoId === planoId && typeof p.requestId === "string" && typeof p.versaoId === "string" && Number.isSafeInteger(p.revision) && (p.modo === "contratos" || p.modo === "evidencias" || p.modo === "exigencias") ? p : "invalido";
  } catch { return "invalido"; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => { await conferirSessao();
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error("Tentativa alterada."); const funcao = p.modo === modo ? "sso_iniciar_revisao_contratos_mediada" : "sso_consultar_recibo_revisao_contratos"; const { data, error } = await supabase.schema("pcm").rpc(funcao, {
        p_ator: userId, p_cliente: p.clienteId, p_plano: p.planoId,
        p_request: p.requestId, p_expected_revision: p.revision,
        p_nova_versao: p.versaoId, p_modo: p.modo,
      });
      if (error) throw error; if (!data || data.requestId !== p.requestId ||
        data.aggregateId !== p.planoId || data.created !== true || data.state !== "rascunho" ||
        !Number.isSafeInteger(data.revision) || data.revision <= p.revision ||
        data.linkedIds?.clienteId !== p.clienteId || data.linkedIds?.versaoId !== p.versaoId ||
        !Number.isSafeInteger(data.contratosCopiados) || data.contratosCopiados < 0 ||
        !Number.isSafeInteger(data.itensNaoCopiados) || data.itensNaoCopiados < 0 ||
        (p.modo !== "contratos" && (!Number.isSafeInteger(data.evidenciasCopiadas) || data.evidenciasCopiadas < 0 || !Number.isSafeInteger(data.evidenciasNaoCopiadas) || data.evidenciasNaoCopiadas < 0)) ||
        (p.modo === "exigencias" && (!Number.isSafeInteger(data.exigenciasPropostas) || data.exigenciasPropostas < 0 || !Number.isSafeInteger(data.exigenciasNaoCopiadas) || data.exigenciasNaoCopiadas < 0)) || data.reconferenciaNecessaria !== true || (p.modo === "exigencias" && data.reconferenciaExigenciasNecessaria !== true)) throw new Error("Resposta inválida."); return data as { contratosCopiados: number; itensNaoCopiados: number; evidenciasCopiadas?: number; evidenciasNaoCopiadas?: number; exigenciasPropostas?: number }; }, onSuccess: async (r, p) => { try { await conferirSessao(); if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(storageKey); } catch { setAviso("Revisão iniciada, mas tentativa local mudou ou não pôde ser removida; procure suporte."); return; } setPendente(null); setConfirmado(false); setAviso(`Revisão iniciada; ${r.contratosCopiados} contrato(s) de resposta copiado(s), ${r.itensNaoCopiados} item(ns) não copiado(s). ${r.evidenciasCopiadas !== undefined ? `${r.evidenciasCopiadas} contrato(s) de evidência copiado(s), ${r.evidenciasNaoCopiadas} não copiado(s). ` : "Contratos de evidência não foram copiados por este fluxo. "}${r.exigenciasPropostas !== undefined ? `${r.exigenciasPropostas} proposta(s) normativa(s) exigem reconferência. ` : ""}Confira todas as perguntas, inclusive novas, antes de aprovar.`); await cache.invalidateQueries({ queryKey: planoManutencaoKeys.raiz(userId, clienteId) }); }, onError: () => setAviso("Resultado não confirmado ou revisão obsoleta. Repita a mesma tentativa; procure suporte em conflito."), onSettled: () => { trava.current = false; } });
  const enviar = (p: Pedido) => { if (trava.current) return;
    if (!permitirNova && !pendente) return;
    if (!mediada) { setAviso("Revisão mediada indisponível; a tentativa permanece guardada."); return; } try { const anterior = sessionStorage.getItem(storageKey); if (p.modo !== modo && (!pendente || pendente === "invalido" || JSON.stringify(pendente) !== JSON.stringify(p) || anterior !== JSON.stringify(p))) throw new Error("Tentativa anterior indisponível."); if (anterior !== null && anterior !== JSON.stringify(p)) throw new Error(); sessionStorage.setItem(storageKey, JSON.stringify(p)); } catch { setAviso("Tentativa local indisponível ou diferente; nada enviado. Procure suporte."); return; } trava.current = true; setPendente(p); envio.mutate(p); };
  if (!permitirNova && !pendente) return null;
  return <section aria-label="Revisão com contratos">{!mediada && <p>Revisão mediada indisponível. Tentativas pendentes permanecem guardadas.</p>}<h3>Iniciar revisão com contratos de perguntas</h3>{pendente && pendente !== "invalido" && pendente.modo !== modo && <p>A configuração mudou. Esta tentativa será apenas consultada; se não houver recibo, permanecerá guardada para tratamento.</p>}<p>Copia somente contratos com pergunta e questionário iguais à versão aprovada. {(pendente && pendente !== "invalido" ? pendente.modo : modo) !== "contratos" ? "Inclui contratos de evidência." : "Este fluxo não copia contratos de evidência."} {(pendente && pendente !== "invalido" ? pendente.modo : modo) === "exigencias" && "Exigências normativas serão propostas para reconferência, sem validação automática."} A conferência de todas as perguntas continua necessária; não altera o questionário Auvo nem cria OS.</p>
    <label><input type="checkbox" checked={confirmado} disabled={!!pendente || envio.isPending} onChange={(e) => setConfirmado(e.target.checked)} /> Confirmo iniciar revisão e revisar os contratos copiados</label>{" "}
    <button type="button" disabled={!mediada || !permitirNova || !confirmado || !!pendente || envio.isPending} onClick={() => enviar({ requestId: crypto.randomUUID(), clienteId, planoId, revision, versaoId: crypto.randomUUID(), modo })}>Iniciar revisão com contratos</button>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={!mediada || envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
