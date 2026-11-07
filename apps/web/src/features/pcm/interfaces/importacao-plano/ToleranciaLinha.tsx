import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { obterToleranciaCronograma, salvarToleranciaCronograma, type PedidoToleranciaCronograma } from "../../infrastructure/supabase-importacao-plano-adapter";

export function ToleranciaLinha({ userId, clienteId, loteId, revisao, chave, mapeamentoId }: { userId: string; clienteId: string; loteId: string; revisao: number; chave: string; mapeamentoId: string }) {
  const cache = useQueryClient(); const storageKey = `sso-tolerancia-cronograma:${JSON.stringify([userId, clienteId, loteId, chave])}`;
  const [antes, setAntes] = useState("0"); const [depois, setDepois] = useState("0"); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<PedidoToleranciaCronograma | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as PedidoToleranciaCronograma;
    return p.loteId === loteId && p.chave === chave && typeof p.requestId === "string" && typeof p.mapeamentoId === "string" && Number.isSafeInteger(p.expectedRevision) && Number.isSafeInteger(p.antes) && Number.isSafeInteger(p.depois) ? p : "invalido";
  } catch { return "invalido"; } });
  const atual = useQuery({ queryKey: ["tolerancia-cronograma", userId, clienteId, loteId, mapeamentoId], gcTime: 0, queryFn: ({ signal }) => obterToleranciaCronograma(clienteId, loteId, mapeamentoId, signal) });
  const envio = useMutation({ mutationFn: salvarToleranciaCronograma, onSuccess: async () => {
    await Promise.all([cache.invalidateQueries({ queryKey: ["conferencia-integrada-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["diagnostico-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["tolerancia-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["importacao-plano", userId, clienteId] })]);
    try { sessionStorage.removeItem(storageKey); } catch { setAviso("Tentativa local não pôde ser removida; procure suporte."); return; }
    setPendente(null); setAviso("Tolerância registrada; confira novamente a linha antes de aprovar.");
  }, onError: () => setAviso("Resultado não confirmado ou revisão obsoleta. Repita a mesma tentativa; procure suporte em conflito.") });
  const enviar = (p: PedidoToleranciaCronograma) => { try { sessionStorage.setItem(storageKey, JSON.stringify(p)); } catch { setAviso("Não foi possível guardar tentativa; nada enviado."); return; } setPendente(p); envio.mutate(p); };
  return <div><p>Sem configuração, tolerância é zero antes e depois. Rotinas legais exigem conferência da norma aplicável.</p>
    {atual.data && <p>Atual: {atual.data.antes} dias antes e {atual.data.depois} depois ({atual.data.configurada ? "declarada" : "padrão zero"}).</p>}
    {atual.isError && <p role="alert">Não foi possível consultar tolerância. <button type="button" onClick={() => void atual.refetch()}>Tentar novamente</button></p>}
    <form onSubmit={(e) => { e.preventDefault(); const a = Number(antes), d = Number(depois); if (pendente || !/^\d+$/.test(antes) || !/^\d+$/.test(depois) || !Number.isSafeInteger(a) || !Number.isSafeInteger(d) || a > 2147483647 || d > 2147483647) return;
      enviar({ requestId: crypto.randomUUID(), loteId, expectedRevision: revisao, chave, mapeamentoId, antes: a, depois: d }); }}>
      <fieldset disabled={!!pendente || envio.isPending || atual.isError || atual.isFetching}><label>Dias antes <input required type="number" min="0" max="2147483647" value={antes} onChange={(e) => setAntes(e.target.value)} /></label>{" "}
      <label>Dias depois <input required type="number" min="0" max="2147483647" value={depois} onChange={(e) => setDepois(e.target.value)} /></label><button type="submit">Guardar tolerância</button></fieldset>
    </form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}
    {aviso && <p role="status">{aviso}</p>}
  </div>;
}
