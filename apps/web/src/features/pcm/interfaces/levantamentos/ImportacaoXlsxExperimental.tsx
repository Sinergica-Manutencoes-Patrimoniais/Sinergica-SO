import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { receberEstruturaXlsx, reconciliarTentativaEstruturaXlsx } from "../../infrastructure/receber-estrutura-xlsx";
import { receberEstruturaXlsxLocal, recuperarEstruturaXlsxLocal } from "../../infrastructure/receber-estrutura-xlsx-local";
import { PreviaXlsxEstrutura } from "./PreviaXlsxEstrutura";

/** A interface e a recepção no servidor possuem flags independentes, fechadas por padrão. */
export function ImportacaoXlsxExperimental({ userId, clienteId, onRecebido }: { userId: string; clienteId: string; onRecebido?: (loteId: string) => void }) {
  const client = useQueryClient();
  const [recuperando, setRecuperando] = useState(false); const [avisoRecuperacao, setAvisoRecuperacao] = useState("");
  const travaRecuperacao = useRef(false);
  const montado = useRef(false);
  const contexto = useRef({ userId, clienteId, geracao: 0 });
  if (contexto.current.userId !== userId || contexto.current.clienteId !== clienteId)
    contexto.current = { userId, clienteId, geracao: contexto.current.geracao + 1 };
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const desenvolvimento = import.meta.env.DEV && import.meta.env.VITE_SSO_ESTRUTURA_XLSX_DEV_ENABLED === "true";
  const interfaceHabilitada = desenvolvimento || import.meta.env.VITE_SSO_ESTRUTURA_XLSX_ENABLED === "true";
  if (!interfaceHabilitada) return null;
  const localHabilitado = import.meta.env.VITE_SSO_ESTRUTURA_XLSX_LOCAL_DECLARADO_ENABLED === "true";
  let tentativaLocal = false; let armazenamentoIndisponivel = false;
  if (localHabilitado) { try { tentativaLocal = sessionStorage.getItem(`sso-xlsx-local:${JSON.stringify([userId, clienteId])}`) !== null; } catch { armazenamentoIndisponivel = true; } }
  async function recuperarLocal() {
    if (travaRecuperacao.current) return; travaRecuperacao.current = true; setRecuperando(true); setAvisoRecuperacao(""); const geracao = contexto.current.geracao;
    try { const id = await recuperarEstruturaXlsxLocal(userId, clienteId); await client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"] });
      const sessao = await supabase.auth.getUser(); if (montado.current && contexto.current.geracao === geracao && !sessao.error && sessao.data.user?.id === userId) { setAvisoRecuperacao(`Lote ${id} confirmado para conferência; arquivo não atestado.`); onRecebido?.(id); }
    } catch { if (montado.current && contexto.current.geracao === geracao) setAvisoRecuperacao("Não foi possível confirmar a tentativa. Preserve os dados e consulte suporte."); }
    finally { travaRecuperacao.current = false; if (montado.current && contexto.current.geracao === geracao) setRecuperando(false); }
  }
  return <><PreviaXlsxEstrutura
    key={JSON.stringify([userId, clienteId])}
    clienteId={clienteId}
    permitirRecepcao
    enviarLocalDeclarado={localHabilitado && !recuperando ? async ({ bytes, aba, origem }) => {
      const geracao = contexto.current.geracao;
      const id = await receberEstruturaXlsxLocal({ userId, clienteId, origem, aba, bytes });
      await client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"] });
      const sessao = await supabase.auth.getUser();
      if (montado.current && contexto.current.geracao === geracao && contexto.current.userId === userId && contexto.current.clienteId === clienteId && !sessao.error && sessao.data.user?.id === userId) onRecebido?.(id);
      return `Lote ${id} recebido como dados declarados para conferência; arquivo não atestado no servidor.`;
    } : undefined}
    enviarExperimental={async ({ bytes, aba, origem }) => {
      const geracao = contexto.current.geracao;
      const recibo = await receberEstruturaXlsx({ userId, clienteId, origem, aba, bytes }, async () => {
        await Promise.all([
          client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId, "lotes"] }),
          client.invalidateQueries({ queryKey: ["quarentena-csv", userId, clienteId, "lotes"] }),
        ]);
      });
      if (recibo.destino === "lote" && onRecebido) {
        try {
          const sessao = await supabase.auth.getUser();
          if (montado.current && contexto.current.geracao === geracao && contexto.current.userId === userId && contexto.current.clienteId === clienteId &&
            !sessao.error && sessao.data.user?.id === userId) onRecebido(recibo.id);
        } catch { /* O recibo continua confirmado; não navegar com sessão desconhecida. */ }
      }
      return recibo.destino === "lote" ? `Lote ${recibo.id} recebido para conferência.` : `Quarentena ${recibo.id} recebida para revisão.`;
    }}
    reconciliarExperimental={async ({ bytes, aba, origem }) => {
      await reconciliarTentativaEstruturaXlsx({ userId, clienteId, origem, aba, bytes });
      return "Tentativa reconciliada. Confira os dados e repita o envio para obter confirmação.";
    }} />
    {localHabilitado && <section aria-label="Recuperação de XLSX declarado"><p>A recuperação repete apenas o pedido armazenado nesta aba; não pressupõe falha anterior.</p>
      {armazenamentoIndisponivel && <p role="alert">Armazenamento indisponível. Consulte suporte antes de receber outro lote.</p>}
      <button type="button" disabled={recuperando || armazenamentoIndisponivel} onClick={() => void recuperarLocal()}>{tentativaLocal ? "Repetir tentativa de XLSX declarada" : "Procurar e repetir tentativa nesta aba"}</button>
      {avisoRecuperacao && <p role="status">{avisoRecuperacao}</p>}
    </section>}</>;
}
