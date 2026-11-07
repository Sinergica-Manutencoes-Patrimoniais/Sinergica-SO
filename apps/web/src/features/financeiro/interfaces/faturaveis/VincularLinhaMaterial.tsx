import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ linha_id: z.string().guid(), descricao: z.string(), quantidade: z.number().int().positive(), preco_unitario_centavos: z.string().regex(/^\d+$/) }).strict();
const pedido = z.object({ requestId: z.string().guid(), declaracaoId: z.string().guid(), linhaId: z.string().guid(), quantidade: z.number().int().min(1).max(999999), preco: z.number().int().min(0).max(1000000000000), justificativa: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedido>;
export function VincularLinhaMaterial({ usuario, cliente, declaracaoId }: { usuario: string; cliente: string; declaracaoId: string }) {
  const chave = `sso-material-linha:${JSON.stringify([usuario, cliente, declaracaoId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); if (!s) return null;
    const p = pedido.parse(JSON.parse(s)); return p.declaracaoId === declaracaoId ? p : "invalido"; } catch { return "invalido"; } });
  const [linhaId, setLinhaId] = useState(""); const [quantidade, setQuantidade] = useState(""); const [justificativa, setJustificativa] = useState("");
  const [aviso, setAviso] = useState(""); const enviando = useRef(false);
  const linhas = useQuery({ queryKey: ["material-linhas-proposta", usuario, cliente, declaracaoId], gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_linhas_material_proposta", { p_cliente_id: cliente, p_declaracao_id: declaracaoId }).abortSignal(signal);
      if (error) throw error; return z.array(linha).max(100).parse(data); } });
  const comando = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = await supabase.schema("financeiro").rpc("sso_vincular_material_linha", { p_request_id: p.requestId, p_cliente_id: cliente,
      p_declaracao_id: p.declaracaoId, p_linha_id: p.linhaId, p_quantidade: p.quantidade, p_preco_unitario: p.preco, p_justificativa: p.justificativa });
    if (error) throw error; if (z.string().guid().parse(data) !== p.declaracaoId) throw new Error("Resposta divergente");
  }, onSuccess: (_r, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Linha vinculada sem criar faturável ou cobrança.");
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar() { if (pendente || enviando.current || linhas.isFetching || linhas.isError) return; try {
    const selecionada = linhas.data?.find((i) => i.linha_id === linhaId); if (!selecionada || !/^\d+$/.test(quantidade)) throw new Error("Dados inválidos");
    const p = pedido.parse({ requestId: crypto.randomUUID(), declaracaoId, linhaId, quantidade: Number(quantidade), preco: Number(selecionada.preco_unitario_centavos), justificativa: justificativa.trim() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira linha, quantidade e justificativa. Nada foi enviado."); } }
  return <section><p>O vínculo de linha é preliminar e não comprova consumo ou elegibilidade de cobrança.</p>
    {linhas.isFetching && <p>Consultando linhas aprovadas…</p>}
    {linhas.isError && <p role="alert">Linhas indisponíveis. <button type="button" onClick={() => void linhas.refetch()}>Tentar novamente</button></p>}
    {!linhas.isFetching && !linhas.isError && linhas.data?.length === 0 && <p>Não há vínculo preliminar ou itens estruturados disponíveis.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir vínculo da linha</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        <label>Linha aprovada <select required value={linhaId} onChange={(e) => setLinhaId(e.target.value)}><option value="">Selecione</option>
          {linhas.data?.map((i) => <option key={i.linha_id} value={i.linha_id}>{i.descricao} · {i.quantidade} × {i.preco_unitario_centavos} centavos</option>)}</select></label>
        <label>Quantidade declarada <input required inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>
        <label>Justificativa <input required maxLength={1000} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} /></label>
        <button type="submit" disabled={comando.isPending || linhas.isFetching || linhas.isError}>Vincular linha</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
