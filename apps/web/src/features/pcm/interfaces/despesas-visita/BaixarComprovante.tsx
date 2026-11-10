import { useLayoutEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { baixarComprovanteDespesa } from "../../infrastructure/supabase-despesas-visita-adapter";

export function BaixarComprovante({ userId, clienteId, visitaId, despesaId }: { userId: string; clienteId: string; visitaId: string; despesaId: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const contexto = JSON.stringify([userId, clienteId, visitaId, despesaId]);
  const contextoAtual = useRef(contexto); contextoAtual.current = contexto;
  const geracao = useRef(0); const ocupado = useRef<number | null>(null); const montado = useRef(false);
  useLayoutEffect(() => {
    montado.current = true; geracao.current++; ocupado.current = null; setCarregando(false); setErro(false);
    return () => { montado.current = false; geracao.current++; };
  }, [contexto]);
  if (import.meta.env.VITE_SSO_COMPROVANTES_DESPESA_ENABLED !== "true") return null;
  async function baixar() {
    if (ocupado.current !== null) return;
    const geracaoSolicitada = geracao.current;
    ocupado.current = geracaoSolicitada;
    setCarregando(true); setErro(false);
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const arquivo = await baixarComprovanteDespesa(despesaId);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (!montado.current || contextoAtual.current !== contexto || geracao.current !== geracaoSolicitada) return;
      const endereco = URL.createObjectURL(arquivo);
      const link = document.createElement("a");
      link.href = endereco; link.download = "comprovante"; link.click();
      setTimeout(() => URL.revokeObjectURL(endereco), 1000);
    } catch { if (montado.current && contextoAtual.current === contexto && geracao.current === geracaoSolicitada) setErro(true); }
    finally { if (ocupado.current === geracaoSolicitada) ocupado.current = null; if (montado.current && contextoAtual.current === contexto && geracao.current === geracaoSolicitada) setCarregando(false); }
  }
  return <span><button type="button" disabled={carregando} onClick={() => void baixar()}>Baixar comprovante</button>
    {erro && <span role="alert">Comprovante indisponível ou sem acesso.</span>}</span>;
}
