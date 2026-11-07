import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { classificarLinhaCronograma, diagnosticarCronograma, type PedidoClassificacaoCronograma } from "../../infrastructure/supabase-importacao-plano-adapter";

export function ClassificacaoLinha({ userId, clienteId, loteId }: { userId: string; clienteId: string; loteId: string }) {
  const cache = useQueryClient(); const storageKey = `sso-classificacao-cronograma:${JSON.stringify([userId, clienteId, loteId])}`;
  const [chave, setChave] = useState(""); const [tipo, setTipo] = useState<PedidoClassificacaoCronograma["tipo"]>("dado");
  const [conferencia, setConferencia] = useState<PedidoClassificacaoCronograma["conferencia"]>("pendente"); const [justificativa, setJustificativa] = useState(""); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<PedidoClassificacaoCronograma | "invalido" | null>(() => { try {
    const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as PedidoClassificacaoCronograma;
    return p.loteId === loteId && typeof p.requestId === "string" && Number.isSafeInteger(p.expectedRevision) && typeof p.chave === "string" && ["cabecalho", "dado", "ignorada"].includes(p.tipo) && ["pendente", "concluida"].includes(p.conferencia) && typeof p.justificativa === "string" ? p : "invalido";
  } catch { return "invalido"; } });
  const diagnostico = useQuery({ queryKey: ["diagnostico-cronograma", userId, clienteId, loteId], gcTime: 0, queryFn: ({ signal }) => diagnosticarCronograma(clienteId, loteId, signal) });
  const envio = useMutation({ mutationFn: classificarLinhaCronograma, onSuccess: async () => {
    await Promise.all([cache.invalidateQueries({ queryKey: ["conferencia-integrada-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["diagnostico-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["importacao-plano", userId, clienteId, "lotes"] })]);
    try { sessionStorage.removeItem(storageKey); } catch { setAviso("Não foi possível limpar a tentativa local; procure suporte."); return; }
    setPendente(null); setAviso("Classificação registrada; não aprova nem incorpora o lote.");
  }, onError: () => setAviso("Resultado não confirmado ou revisão obsoleta; repita a mesma tentativa e procure suporte se houver conflito.") });
  const enviar = (p: PedidoClassificacaoCronograma) => { try { sessionStorage.setItem(storageKey, JSON.stringify(p)); } catch { setAviso("Não foi possível guardar tentativa; nada enviado."); return; } setPendente(p); envio.mutate(p); };
  return <section aria-label="Classificação e diagnóstico do cronograma"><h4>Classificação de linha e conferência</h4>
    <p>Classifique cada linha após leitura da matriz original. Concluir conferência não aprova o lote nem cria Rotinas.</p>
    {diagnostico.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={() => void diagnostico.refetch()}>Tentar novamente</button></p>}
    {diagnostico.data && !diagnostico.isFetching && <><p>Revisão {diagnostico.data.revision}: {diagnostico.data.linhasBrutas} linhas brutas; {diagnostico.data.linhasClassificadas} classificadas ({diagnostico.data.cabecalhosDeclarados} cabeçalhos, {diagnostico.data.dadosDeclarados} dados, {diagnostico.data.ignoradasDeclaradas} ignoradas); {diagnostico.data.conferenciasConcluidas} conferências concluídas.</p>
      <p>Identificadas: {diagnostico.data.linhasComIdentidade}; mapeadas: {diagnostico.data.linhasComMapeamento}; rejeitadas: {diagnostico.data.linhasRejeitadas}. Contagens não comprovam que se referem às mesmas linhas.</p>
      <p>Indicadores preliminares não autorizam aprovação. A solicitação passa por verificação transacional. Ressalvas: {diagnostico.data.impedimentos.join(", ")}.</p></>}
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || !diagnostico.data || diagnostico.isFetching || diagnostico.isError || !chave.trim() || !justificativa.trim()) return;
      enviar({ requestId: crypto.randomUUID(), loteId, expectedRevision: diagnostico.data.revision, chave: chave.trim(), tipo, conferencia, justificativa: justificativa.trim() }); }}>
      <fieldset disabled={!!pendente || envio.isPending || !diagnostico.data || diagnostico.isFetching || diagnostico.isError}>
        <label>Chave da linha <input required maxLength={200} value={chave} onChange={(e) => setChave(e.target.value)} /></label>{" "}
        <label>Tipo <select value={tipo} onChange={(e) => setTipo(e.target.value as PedidoClassificacaoCronograma["tipo"])}><option value="cabecalho">Cabeçalho</option><option value="dado">Dado</option><option value="ignorada">Ignorada</option></select></label>{" "}
        <label>Conferência <select value={conferencia} onChange={(e) => setConferencia(e.target.value as PedidoClassificacaoCronograma["conferencia"])}><option value="pendente">Pendente</option><option value="concluida">Concluída</option></select></label>{" "}
        <label>Justificativa <textarea required maxLength={2000} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} /></label><button type="submit">Registrar classificação</button>
      </fieldset>
    </form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
