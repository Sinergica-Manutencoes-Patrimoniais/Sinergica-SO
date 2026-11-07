import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Linha = { chave: string; tipo: string; atributos: Record<string, unknown> };
type Props = { userId: string; clienteId: string; loteId: string; revisao: number; linhas: Linha[]; carregando: boolean };
const itemSchema = z.object({ chave: z.string().min(1).max(200), atributos: z.record(z.string(), z.unknown()), requestId: z.string().uuid() }).strict();
const pedidoSchema = z.object({ loteId: z.string().uuid(), revision: z.number().int().positive(), itens: z.array(itemSchema).min(1).max(50), proximo: z.number().int().nonnegative() }).strict().refine(p => p.proximo <= p.itens.length);
type Pedido = z.infer<typeof pedidoSchema>;
type Selecionada = { chave: string; tipo: string; atributos: Record<string, unknown>; revision: number };
export function ConferirSelecao(props: Props) {
  if (import.meta.env.VITE_SSO_CONFERENCIA_LEVANTAMENTOS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.loteId])} {...props}/>;
}
function Conteudo({ userId, clienteId, loteId, revisao, linhas, carregando }: Props) {
  const key = `sso-conferencia-selecao:${JSON.stringify([userId, clienteId, loteId])}`; const client = useQueryClient(); const trava = useRef(false); const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const [selecionadas, setSelecionadas] = useState<Selecionada[]>([]); const [confirmado, setConfirmado] = useState(false); const [executando, setExecutando] = useState(false); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(key); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.loteId === loteId ? p : "invalido"; } catch { return "invalido"; } });
  async function conferirSessao() { const r = await supabase.auth.getUser(); if (!montado.current || r.error || r.data.user?.id !== userId) throw new Error("Sessão ou contexto alterado"); }
  async function executar(inicial: Pedido) {
    if (trava.current) return; trava.current = true; setExecutando(true); let atual = inicial;
    try {
      while (atual.proximo < atual.itens.length) {
        await conferirSessao(); if (sessionStorage.getItem(key) !== JSON.stringify(atual)) throw new Error("Tentativa local divergente");
        const item = atual.itens[atual.proximo]; if (!item) throw new Error("Item ausente"); const esperada = atual.revision + atual.proximo;
        const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_linha_autorizada", { p_request_id: item.requestId, p_lote_id: loteId, p_expected_revision: esperada, p_chave: item.chave, p_atributos: item.atributos }); if (error) throw error;
        const r = z.object({ loteId: z.string().uuid(), chave: z.string(), revision: z.number().int().positive(), requestId: z.string().uuid() }).strict().parse(data);
        if (r.loteId !== loteId || r.chave !== item.chave || r.revision !== esperada + 1 || r.requestId !== item.requestId) throw new Error("Resposta divergente");
        await conferirSessao(); const proximo = pedidoSchema.parse({ ...atual, proximo: atual.proximo + 1 }); if (sessionStorage.getItem(key) !== JSON.stringify(atual)) throw new Error("Tentativa divergente");
        sessionStorage.setItem(key, JSON.stringify(proximo)); atual = proximo; setPendente(proximo);
      }
      await conferirSessao(); if (sessionStorage.getItem(key) !== JSON.stringify(atual)) throw new Error("Tentativa divergente"); sessionStorage.removeItem(key); setPendente(null); setSelecionadas([]); setConfirmado(false); setAviso("Conferências registradas. Nenhum lote foi aprovado nem cadastro incorporado.");
    } catch { setAviso(`Interrompido após ${atual.proximo} de ${atual.itens.length} confirmações. As anteriores permanecem; repita a mesma tentativa ou consulte suporte.`); }
    finally { trava.current = false; setExecutando(false); await client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId] }); }
  }
  function iniciar() {
    if (pendente || trava.current || carregando || !confirmado || !selecionadas.length || selecionadas.some(s => s.revision !== revisao)) return;
    try { const p = pedidoSchema.parse({ loteId, revision: revisao, itens: selecionadas.map(s => ({ chave: s.chave, atributos: s.atributos, requestId: crypto.randomUUID() })), proximo: 0 }); if (sessionStorage.getItem(key) !== null) throw new Error("Tentativa existente"); sessionStorage.setItem(key, JSON.stringify(p)); setPendente(p); void executar(p); } catch { setAviso("Confira seleção, revisão e sessão. Nada foi enviado."); }
  }
  const obsoleta = selecionadas.some(s => s.revision !== revisao);
  return <section aria-label="Conferir seleção de linhas"><h4>Conferir seleção de linhas</h4><p>Selecione até 50 linhas carregadas e confira seus retratos. Cada linha é uma transação independente: falha não reverte as anteriores. Não aprova lote nem incorpora cadastros. Os retratos e identificadores da tentativa são guardados temporariamente nesta sessão do navegador para recuperação; podem conter dados sensíveis.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte antes de reenviar.</p>}
    {pendente && pendente !== "invalido" ? <><p>Confirmações registradas nesta sessão: {pendente.proximo} de {pendente.itens.length}.</p><button type="button" disabled={executando} onClick={() => void executar(pendente)}>Retomar mesma tentativa</button></> : !pendente && <>
      <ul>{linhas.map(l => { const marcada = selecionadas.some(s => s.chave === l.chave); return <li key={l.chave}><label><input type="checkbox" checked={marcada} disabled={carregando || (!marcada && selecionadas.length >= 50)} onChange={e => { const checked = e.target.checked; setSelecionadas(atuais => checked ? [...atuais, { chave: l.chave, tipo: l.tipo, atributos: structuredClone(l.atributos), revision: revisao }] : atuais.filter(s => s.chave !== l.chave)); setConfirmado(false); }}/> {l.chave} · {l.tipo}</label></li>; })}</ul>
      {selecionadas.length > 0 && <details><summary>Retratos selecionados ({selecionadas.length})</summary><ol>{selecionadas.map(s => <li key={s.chave}>{s.chave} · {s.tipo}<pre>{JSON.stringify(s.atributos, null, 2)}</pre></li>)}</ol></details>}
      {obsoleta && <p role="alert">A revisão do lote mudou. Limpe a seleção e confira novamente.</p>}
      <button type="button" disabled={!selecionadas.length} onClick={() => { setSelecionadas([]); setConfirmado(false); }}>Limpar seleção</button><label><input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)}/> Conferi localização, classificação, vínculos, códigos e duplicidades das linhas selecionadas.</label>
      <button type="button" disabled={!confirmado || !selecionadas.length || obsoleta || carregando || executando} onClick={iniciar}>Registrar conferências</button><p>Use a paginação do lote para selecionar outras linhas. Alterações concorrentes são recusadas pelo servidor.</p>
    </>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
