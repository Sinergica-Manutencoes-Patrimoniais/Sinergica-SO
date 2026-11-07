import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const schema = z.object({ requestId: z.string().guid(), propostaId: z.string().guid(), modo: z.enum(["integral", "linhas"]), motivo: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof schema>;
export function ModoProposta({ usuario, cliente }: { usuario: string; cliente: string }) {
  const chave = `sso-modo-proposta:${JSON.stringify([usuario, cliente])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); return s ? schema.parse(JSON.parse(s)) : null; } catch { return "invalido"; } });
  const [proposta, setProposta] = useState(""); const [modo, setModo] = useState<"integral" | "linhas">("integral"); const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const comando = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = await supabase.schema("financeiro").rpc("sso_definir_modo_proposta", { p_request_id: p.requestId,
      p_cliente_id: cliente, p_proposta_id: p.propostaId, p_modo: p.modo, p_motivo: p.motivo });
    if (error) throw error; if (z.string().guid().parse(data) !== p.propostaId) throw new Error("Resposta divergente");
  }, onSuccess: (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas a tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Modo registrado; nenhuma cobrança foi criada.");
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || enviando.current) return; try {
    const p = schema.parse({ requestId: crypto.randomUUID(), propostaId: proposta.trim(), modo, motivo: motivo.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira os dados e a sessão. Nada foi enviado."); } }
  if (import.meta.env.VITE_SSO_MODO_FATURAMENTO_PROPOSTA_ENABLED !== "true") return null;
  return <section><h3>Modo de faturamento da proposta</h3><p>Escolha integral ou linhas. A escolha é definitiva neste fluxo e não cria cobrança.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Proposta aceita <input required value={proposta} onChange={(e) => setProposta(e.target.value)} /></label>
        <label>Modo <select value={modo} onChange={(e) => setModo(e.target.value as "integral" | "linhas")}><option value="integral">Integral</option><option value="linhas">Por linhas</option></select></label>
        <label>Motivo <input required maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <button type="submit" disabled={comando.isPending}>Registrar modo</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
