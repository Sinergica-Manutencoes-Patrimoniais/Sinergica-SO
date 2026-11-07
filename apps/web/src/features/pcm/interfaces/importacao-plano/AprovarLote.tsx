import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { aprovarCronogramaStaging, diagnosticarCronograma, type PedidoAprovacaoCronograma } from "../../infrastructure/supabase-importacao-plano-adapter";

export function AprovarLote({ userId, clienteId, loteId }: { userId: string; clienteId: string; loteId: string }) {
  const storageKey = `sso-aprovacao-cronograma:${JSON.stringify([userId, clienteId, loteId])}`; const cache = useQueryClient();
  const [motivo, setMotivo] = useState(""); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<PedidoAprovacaoCronograma | "invalido" | null>(() => { try {
    const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as PedidoAprovacaoCronograma;
    return p.clienteId === clienteId && p.loteId === loteId && typeof p.requestId === "string" && Number.isSafeInteger(p.expectedRevision) && typeof p.justificativa === "string" ? p : "invalido";
  } catch { return "invalido"; } });
  const permissao = useQuery({ queryKey: ["aprovar-cronograma-permissao", userId, clienteId], gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async () => (await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)) && (await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar", clienteId)) });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const diagnostico = useQuery({ queryKey: ["diagnostico-cronograma", userId, clienteId, loteId], enabled: permitido, gcTime: 0, queryFn: ({ signal }) => diagnosticarCronograma(clienteId, loteId, signal) });
  const envio = useMutation({ mutationFn: aprovarCronogramaStaging, onSuccess: async () => { try { sessionStorage.removeItem(storageKey); } catch { setAviso("Comando concluído, mas não foi possível limpar tentativa local; procure suporte."); return; }
    setPendente(null); setAviso("Revisão do lote aprovada somente em staging. Nenhum Plano ou Rotina foi criado.");
    await cache.invalidateQueries({ queryKey: ["diagnostico-cronograma", userId, clienteId, loteId] }); await cache.invalidateQueries({ queryKey: ["importacao-plano", userId, clienteId, "lotes"] });
  }, onError: () => setAviso("Aprovação não confirmada: gate, permissão, revisão ou conferência podem bloquear. Repita a mesma tentativa; procure suporte em conflito.") });
  const enviar = (p: PedidoAprovacaoCronograma) => { try { sessionStorage.setItem(storageKey, JSON.stringify(p)); } catch { setAviso("Não foi possível guardar tentativa; nada enviado."); return; } setPendente(p); envio.mutate(p); };
  if (permissao.isPending || permissao.isFetching) return <p>Verificando autorização…</p>;
  if (permissao.isError) return <p role="alert">Não foi possível verificar autorização. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (!permitido) return null;
  return <section aria-label="Aprovação de lote em staging"><h4>Aprovar revisão do lote em staging</h4>
    <p>Não aprova Plano nem cria Rotinas. A verificação transacional pode bloquear por linhas incompletas ou alvos indisponíveis; dados rejeitados não são elegíveis. A aprovação de uma revisão não cobre alterações posteriores.</p>
    {diagnostico.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={() => void diagnostico.refetch()}>Tentar novamente</button></p>}
    {diagnostico.data && !diagnostico.isFetching && <p>Revisão consultada: {diagnostico.data.revision}. Indicadores não comprovam aprovação: {diagnostico.data.impedimentos.join(", ")}.</p>}
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || !diagnostico.data || diagnostico.isFetching || diagnostico.isError || !motivo.trim()) return;
      enviar({ requestId: crypto.randomUUID(), clienteId, loteId, expectedRevision: diagnostico.data.revision, justificativa: motivo.trim() }); }}>
      <fieldset disabled={!!pendente || envio.isPending || !diagnostico.data || diagnostico.isFetching || diagnostico.isError}>
        <label>Justificativa <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label><button type="submit">Solicitar aprovação de staging</button>
      </fieldset>
    </form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
