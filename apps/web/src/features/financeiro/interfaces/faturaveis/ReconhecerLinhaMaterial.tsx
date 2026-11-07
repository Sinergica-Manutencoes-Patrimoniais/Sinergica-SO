import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const schema = z.object({ requestId: z.string().guid(), declaracaoId: z.string().guid(), quantidade: z.number().int().min(1).max(999999),
  preco: z.number().int().min(0).max(1000000000000), competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/) }).strict();
type Pedido = z.infer<typeof schema>;
export function ReconhecerLinhaMaterial({ usuario, cliente, declaracaoId }: { usuario: string; cliente: string; declaracaoId: string }) {
  const chave = `sso-candidato-material:${JSON.stringify([usuario, cliente, declaracaoId])}`; const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = schema.parse(JSON.parse(s)); return p.declaracaoId === declaracaoId ? p : "invalido"; } catch { return "invalido"; } });
  const [quantidade, setQuantidade] = useState(""); const [preco, setPreco] = useState(""); const [mes, setMes] = useState("");
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const comando = useMutation({ mutationFn: async (p: Pedido) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_reconhecer_linha_material", {
    p_request_id: p.requestId, p_cliente_id: cliente, p_declaracao_id: p.declaracaoId, p_quantidade: p.quantidade, p_preco_unitario: p.preco, p_competencia: p.competencia });
    if (error) throw error; return z.string().guid().parse(data);
  }, onSuccess: async (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Candidato pendente criado; nenhuma cobrança foi criada."); await cache.invalidateQueries({ queryKey: ["faturaveis", usuario, cliente] });
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || enviando.current) return; try {
    if (!/^\d+$/.test(quantidade) || !/^\d+$/.test(preco)) throw new Error("Valores inválidos");
    const p = schema.parse({ requestId: crypto.randomUUID(), declaracaoId, quantidade: Number(quantidade), preco: Number(preco), competencia: `${mes}-01` });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira quantidade, preço em centavos e competência. Nada foi enviado."); } }
  return <section><p>Reconhecer candidato exige modo por linhas e vínculo aceito; não cria cobrança.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir candidato</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Quantidade vinculada <input required inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>
        <label>Preço unitário em centavos <input required inputMode="numeric" value={preco} onChange={(e) => setPreco(e.target.value)} /></label>
        <label>Competência <input required type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></label>
        <button type="submit" disabled={comando.isPending}>Reconhecer candidato</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
