import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
type Pedido = { requestId: string; clienteId: string; serieId: string; regraId: string; semana: string; visitaId: string; inicio: string; cobertura: string; protocolo?: "coordenado" | "suprimivel" | "legado" };

export function GerarVisitaContratual({ userId, clienteId, serieId }: { userId: string; clienteId: string; serieId: string }) {
  return <GerarVisitaContratualSessao key={JSON.stringify([userId, clienteId, serieId])} userId={userId} clienteId={clienteId} serieId={serieId} />;
}
function GerarVisitaContratualSessao({ userId, clienteId, serieId }: { userId: string; clienteId: string; serieId: string }) {
  const cache = useQueryClient(); const chave = `sso-gerar-visita-contratual:${JSON.stringify([userId, clienteId, serieId])}`; const trava = useRef(false); const [regraId, setRegraId] = useState(""); const [semana, setSemana] = useState(""); const [inicio, setInicio] = useState(""); const [cobertura, setCobertura] = useState(""); const [confirmado, setConfirmado] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = JSON.parse(raw) as Pedido; return p.clienteId === clienteId && p.serieId === serieId && typeof p.requestId === "string" && typeof p.visitaId === "string" && typeof p.regraId === "string" && typeof p.semana === "string" && typeof p.inicio === "string" && typeof p.cobertura === "string" && (p.protocolo === undefined || ["coordenado", "suprimivel", "legado"].includes(p.protocolo)) ? p : "invalido"; } catch { return "invalido"; } });
  const regras = useInfiniteQuery({ queryKey: ["regras-geracao-visita", userId, clienteId, serieId], initialPageParam: 0, gcTime: 0, queryFn: async ({ pageParam, signal }) => { await conferirSessaoDiagnostico(userId, signal); const { data, error } = await supabase.schema("pcm").rpc("sso_pcm_listar_regras_visita", { p_cliente_id: clienteId, p_serie_id: serieId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; if (!Array.isArray(data)) throw new Error("Lista inválida."); await conferirSessaoDiagnostico(userId, signal); return data as { id: string; numero: number; ancora_semana: string; dia_semana: number; intervalo_semanas: number; hora_inicio: string; fuso: string; vigencia_inicio: string; vigencia_fim: string | null }[]; }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.numero : undefined });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
    const parametros = { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_serie_id: p.serieId, p_regra_id: p.regraId,
      p_semana: p.semana, p_visita_id: p.visitaId, p_inicio_em: p.inicio, p_responsavel_id: null, p_cobertura: p.cobertura };
    const protocolo = p.protocolo ?? "legado";
    if(protocolo === "coordenado" && import.meta.env.VITE_SSO_GERACAO_OU_SUPRESSAO_ENABLED !== "true") throw new Error("Geração coordenada indisponível.");
    const consulta = protocolo === "coordenado" ? supabase.schema("pcm").rpc("sso_gerar_visita_ou_suprimir", { ...parametros, p_ator_id: userId })
      : supabase.schema("pcm").rpc("sso_recibo_geracao_visita_legada", {p_ator:userId,p_request:p.requestId,p_cliente:p.clienteId,p_serie:p.serieId,p_regra:p.regraId,p_semana:p.semana,p_visita:p.visitaId,p_inicio:p.inicio,p_responsavel:null,p_cobertura:p.cobertura});
    const { data, error } = await consulta; if (error) throw error;
    let decisao: string;
    if (protocolo === "coordenado") {
      if (!data || data.requestId !== p.requestId || data.clienteId !== p.clienteId || data.serieId !== p.serieId || data.semana !== p.semana ||
        data.efeitoRemoto !== false || !data.detalhe || data.detalhe.requestId !== p.requestId) throw new Error("Resultado inválido.");
      if (data.decisao === "gerada" && data.detalhe.decisao === "criada" && data.detalhe.visitaCriada === true && data.detalhe.visitaId === p.visitaId) decisao = "criada";
      else if (data.decisao === "suprimida_feriado" && data.detalhe.visitaCriada === false && data.detalhe.ocorrenciaCriada === false &&
        data.detalhe.osCriada === false && data.detalhe.tarefaAuvoCriada === false) decisao = "suprimida_feriado";
      else throw new Error("Resultado inválido.");
    } else {
      if (!data || data.requestId !== p.requestId || data.reposicaoCriada !== false || data.fonteOficialComprovada !== false ||
        !["criada", "suprimida_feriado"].includes(data.decisao) || (data.decisao === "criada" && (data.visitaCriada !== true || data.visitaId !== p.visitaId)) ||
        (data.decisao === "suprimida_feriado" && data.visitaCriada !== false)) throw new Error("Resultado inválido.");
      decisao = data.decisao;
    }
    const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    return { decisao };
  }, onSuccess: async (r, p) => { if (r.decisao === "criada") await Promise.all([
    cache.invalidateQueries({ queryKey: ["visitas", userId, clienteId] }),
    cache.invalidateQueries({ queryKey: ["previa-ocorrencia-visita", userId, clienteId] }),
    cache.invalidateQueries({ queryKey: ["ciclos-uniformes", userId, clienteId] }),
    cache.invalidateQueries({ queryKey: ["reserva-futuro-visitas", userId, clienteId] }),
  ]);
    try { const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave); }
    catch { setPendente("invalido"); setAviso("Tentativa alterada ou não removida; procure suporte."); return; }
    setPendente(null); setConfirmado(null); setAviso(r.decisao === "criada" ? "Visita regular em rascunho criada com origem contratual; sem OS ou Auvo." : "Semana suprimida por feriado declarado; nenhuma Visita ou reposição criada.");
    if (r.decisao === "suprimida_feriado") void cache.invalidateQueries({ queryKey: ["historico-supressao-gerador", userId, clienteId] });
  }, onError: (error,p) => {const e=error as {code?:string;message?:string};if(p.protocolo!=="coordenado"&&e.code==="55000"&&e.message==="recibo_legado_indisponivel")setAviso("Recibo antigo não encontrado. O pedido permanece guardado e a situação original não foi comprovada; procure suporte para conferir.");else setAviso("Resultado não confirmado; repita a tentativa. Em conflito de semana ou dúvida de horário procure suporte.");}, onSettled: () => { trava.current = false; } });
  const enviar = (pedido: Pedido) => { if (trava.current) return;
    if (!pendente && import.meta.env.VITE_SSO_GERACAO_OU_SUPRESSAO_ENABLED !== "true") {setAviso("Geração coordenada indisponível; nenhum pedido criado.");return;}
    const p: Pedido = pendente ? pedido : { ...pedido, protocolo: "coordenado" };
    trava.current = true; try { const salvo = sessionStorage.getItem(chave); if (pendente ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); } catch { trava.current = false; setPendente("invalido"); setAviso("Não foi possível guardar tentativa; nada enviado. Procure suporte."); return; } setPendente(p); envio.mutate(p); };
  const regraSelecionada = !regras.isFetching && !regras.isError ? regras.data?.pages.flat().find((r) => r.id === regraId) : undefined;
  const snapshot = regraSelecionada ? JSON.stringify([regraSelecionada, semana, inicio, cobertura]) : null;
  const confirmacaoAtual = snapshot !== null && snapshot === confirmado;
  return <section aria-label="Geração de Visita contratual"><h5>Preparar semana contratual</h5><p>Feriado declarado suprime Visita sem reposição; caso contrário será criada Visita regular em rascunho. A cobertura é declaração humana, não fonte oficial comprovada. Não cria OS nem aciona Auvo; não utilizar até homologação e revisão de concorrência.</p>{regras.isError && <p role="alert">Regras indisponíveis. <button type="button" onClick={() => void regras.refetch()}>Tentar novamente</button></p>}{confirmado && !confirmacaoAtual && <p role="alert">Dados ou regra alterados. Confira e confirme novamente.</p>}<form onSubmit={(e) => { e.preventDefault(); if (pendente || !confirmacaoAtual || regras.isFetching || regras.isError || !semana || !cobertura.trim() || !/T\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/u.test(inicio)) return; enviar({ requestId: crypto.randomUUID(), clienteId, serieId, regraId, semana, visitaId: crypto.randomUUID(), inicio, cobertura: cobertura.trim() }); }}><fieldset disabled={!!pendente || envio.isPending || regras.isFetching || regras.isError}><label>Regra <select required value={regraId} onChange={(e) => setRegraId(e.target.value)}><option value="">Selecione</option>{!regras.isFetching && !regras.isError && regras.data?.pages.flat().map((r) => <option key={r.id} value={r.id}>Regra {r.numero} · dia {r.dia_semana} a cada {r.intervalo_semanas} semana(s) · {r.hora_inicio} {r.fuso} · {r.vigencia_inicio} a {r.vigencia_fim ?? "sem fim"}</option>)}</select></label><label>Segunda-feira da semana <input type="date" required value={semana} onChange={(e) => setSemana(e.target.value)} /></label><label>Início com offset explícito (ex.: 2026-10-29T09:00:00-03:00) <input required value={inicio} onChange={(e) => setInicio(e.target.value)} /></label><label>Fonte e cobertura dos feriados conferidos <textarea required maxLength={500} value={cobertura} onChange={(e) => setCobertura(e.target.value)} /></label><label><input type="checkbox" checked={confirmacaoAtual} disabled={!snapshot} onChange={(e) => setConfirmado(e.target.checked ? snapshot : null)} /> Confirmei a cobertura declarada e o instante com offset, inclusive horário ambíguo</label><button disabled={!confirmacaoAtual}>Processar semana</button></fieldset></form>{regras.hasNextPage && <button type="button" onClick={() => void regras.fetchNextPage()}>Mais regras</button>}{pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}{aviso && <p role="status">{aviso}</p>}</section>;
}
