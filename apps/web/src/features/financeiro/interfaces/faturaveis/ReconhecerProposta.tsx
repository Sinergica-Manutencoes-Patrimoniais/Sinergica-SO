import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const schema = z.object({ requestId: z.string().uuid(), propostaId: z.string().uuid(), versao: z.number().int().positive(),
  valorCentavos: z.number().int().min(0).max(1000000000000), competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/) }).strict();
type Pedido = z.infer<typeof schema>;
export function ReconhecerProposta({ usuario, cliente }: { usuario: string; cliente: string }) {
  const chave = `sso-proposta-faturavel:${JSON.stringify([usuario, cliente])}`; const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); return s ? schema.parse(JSON.parse(s)) : null; } catch { return "invalido"; } });
  const [proposta, setProposta] = useState(""); const [versao, setVersao] = useState(""); const [valor, setValor] = useState(""); const [mes, setMes] = useState("");
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const comando = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = await supabase.schema("financeiro").rpc("sso_reconhecer_proposta_com_fechamento", { p_request_id: p.requestId,
      p_cliente_id: cliente, p_proposta_id: p.propostaId, p_versao: p.versao, p_valor_centavos: p.valorCentavos, p_competencia: p.competencia });
    if (error) throw error; return z.string().uuid().parse(data);
  }, onSuccess: async (_id, p) => {
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Confira a fila."); return; }
    setPendente(null); setAviso("Candidato pendente registrado; nenhuma cobrança foi criada.");
    await cache.invalidateQueries({ queryKey: ["faturaveis", usuario, cliente] });
  }, onError: () => setAviso("Resultado não confirmado. Repita a tentativa e confira origem, valor e competência."),
  onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || enviando.current) return; try {
    if (!/^\d+$/.test(valor) || !/^\d+$/.test(versao)) throw new Error("Número inválido");
    const p = schema.parse({ requestId: crypto.randomUUID(), propostaId: proposta.trim(), versao: Number(versao), valorCentavos: Number(valor), competencia: `${mes}-01` });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente");
    sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira identificador, versão, valor em centavos e competência. Nada foi enviado."); } }
  if (import.meta.env.VITE_SSO_FATURAVEL_PROPOSTA_ENABLED !== "true") return null;
  return <section><h3>Reconhecer proposta aceita</h3><p>Confirme versão e valor da proposta operacional aceita. Isto cria apenas um candidato pendente, sem cobrança.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Identificador da proposta <input required value={proposta} onChange={(e) => setProposta(e.target.value)} /></label>
        <label>Versão aceita <input required inputMode="numeric" value={versao} onChange={(e) => setVersao(e.target.value)} /></label>
        <label>Valor aceito em centavos <input required inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
        <label>Competência <input required type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></label>
        <button type="submit" disabled={comando.isPending}>Reconhecer candidato</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
