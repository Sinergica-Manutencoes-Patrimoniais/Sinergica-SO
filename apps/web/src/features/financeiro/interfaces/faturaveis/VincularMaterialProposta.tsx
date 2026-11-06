import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedido = z.object({ requestId: z.string().uuid(), declaracaoId: z.string().uuid(), propostaId: z.string().uuid(), versao: z.number().int().positive(), motivo: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedido>;
export function VincularMaterialProposta({ usuario, cliente, declaracaoId }: { usuario: string; cliente: string; declaracaoId: string }) {
  const chave = `sso-material-proposta:${JSON.stringify([usuario, cliente, declaracaoId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.declaracaoId === declaracaoId ? p : "invalido"; } catch { return "invalido"; } });
  const [proposta, setProposta] = useState(""); const [versao, setVersao] = useState(""); const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const comando = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = await supabase.schema("financeiro").rpc("sso_vincular_material_proposta", { p_request_id: p.requestId,
      p_declaracao_id: p.declaracaoId, p_cliente_id: cliente, p_proposta_id: p.propostaId, p_versao: p.versao, p_motivo: p.motivo });
    if (error) throw error; if (z.string().uuid().parse(data) !== p.declaracaoId) throw new Error("Resposta divergente");
  }, onSuccess: (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Vínculo preliminar registrado; não cria candidato nem cobrança.");
  }, onError: () => setAviso("Resultado não confirmado; repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || enviando.current) return; try {
    const p = pedido.parse({ requestId: crypto.randomUUID(), declaracaoId, propostaId: proposta.trim(), versao: /^\d+$/.test(versao) ? Number(versao) : NaN, motivo: motivo.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira os dados e a sessão. Nada foi enviado."); } }
  return <section><p>Vínculo preliminar: não comprova preço, quantidade ou elegibilidade faturável.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir vínculo</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Proposta aceita <input required value={proposta} onChange={(e) => setProposta(e.target.value)} /></label>
        <label>Versão <input required inputMode="numeric" value={versao} onChange={(e) => setVersao(e.target.value)} /></label>
        <label>Justificativa <input required maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <button type="submit" disabled={comando.isPending}>Vincular preliminarmente</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
