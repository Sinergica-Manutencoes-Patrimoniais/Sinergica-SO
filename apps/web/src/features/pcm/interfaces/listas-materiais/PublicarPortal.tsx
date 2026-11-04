import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const comandoSchema = z.object({ requestId: z.string().uuid(), listaId: z.string().uuid(),
  expectedRevision: z.number().int().positive(), linhas: z.array(z.object({ descricao: z.string().trim().min(1).max(1000),
    quantidade: z.string().trim().min(1).max(100).nullable(), unidade: z.string().trim().min(1).max(100).nullable() }).strict()).min(1).max(100) }).strict();
type Comando = z.infer<typeof comandoSchema>;
type Props = { usuario: string; cliente: string; ordemServico: string; listaId: string; revisao: number };

export function PublicarPortal(props: Props) {
  if (import.meta.env.VITE_SSO_PUBLICAR_MATERIAIS_PORTAL_ENABLED !== "true" || import.meta.env.VITE_SSO_PUBLICAR_MATERIAIS_MEDIADO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.ordemServico, props.listaId])} {...props} />;
}
function Conteudo({ usuario, cliente, ordemServico, listaId, revisao }: Props) {
  const chave = `sso-publicar-materiais:${usuario}:${cliente}:${ordemServico}:${listaId}`;
  const [texto, setTexto] = useState("");
  const [detalhes, setDetalhes] = useState<Record<number, { quantidade: string; unidade: string }>>({});
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const trava = useRef(false);
  const [pendente, setPendente] = useState<Comando | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const pedido = comandoSchema.parse(JSON.parse(salvo)); return pedido.listaId === listaId ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const enviar = useMutation({ mutationFn: async (pedido: Comando) => {
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== usuario || sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Sessão ou tentativa alterada.");
    if (import.meta.env.VITE_SSO_PUBLICAR_MATERIAIS_MEDIADO_ENABLED !== "true") throw new Error("Publicação mediada indisponível.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_portal_publicar_materiais_mediada", {
      p_ator_id: usuario, p_cliente_id: cliente, p_os_id: ordemServico,
      p_request_id: pedido.requestId, p_lista_id: pedido.listaId,
      p_expected_revision: pedido.expectedRevision, p_linhas: pedido.linhas,
    });
    if (error) throw error;
    if (!data || data.aggregateId !== pedido.listaId || data.requestId !== pedido.requestId || data.revision !== pedido.expectedRevision)
      throw new Error("Resposta inválida.");
  }, onSuccess: async (_data, pedido) => { try { const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== usuario || sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Sessão ou tentativa alterada.");
    sessionStorage.removeItem(chave); } catch { setMensagem("Publicação salva; contate suporte para conferir a tentativa local."); return; }
    setPendente(null); setTexto(""); setDetalhes({}); setConfirmado(null); setMensagem("Versão pública publicada para o Cliente."); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa; não crie outra publicação."), onSettled: () => { trava.current = false; } });
  function registrar(pedido: Comando) {
    if (trava.current) return;
    try { const salvo = sessionStorage.getItem(chave); if (salvo !== null && salvo !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
      if (salvo === null && pendente) throw new Error("Tentativa ausente."); if (salvo === null) sessionStorage.setItem(chave, JSON.stringify(pedido));
    } catch { setMensagem("Não foi possível conferir a tentativa; publicação não enviada."); return; }
    trava.current = true; setPendente(pedido); setMensagem(""); enviar.mutate(pedido);
  }
  const descricoes = texto.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  const fotografia = JSON.stringify([usuario, cliente, ordemServico, listaId, revisao, descricoes, detalhes]);
  function atualizarTexto(novoTexto: string) {
    const proximas = novoTexto.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
    // Só transporta campos quando a descrição identifica uma única linha em ambas as versões.
    const contagem = (linhas: string[], linha: string) => linhas.filter((valor) => valor === linha).length;
    setDetalhes(anteriores => {
      const resultado: typeof anteriores = {};
      proximas.forEach((descricao, indice) => {
        if (contagem(proximas, descricao) !== 1 || contagem(descricoes, descricao) !== 1) return;
        const anterior = descricoes.indexOf(descricao);
        if (anteriores[anterior]) resultado[indice] = anteriores[anterior];
      });
      return resultado;
    });
    setTexto(novoTexto); setConfirmado(null);
  }
  return <form onSubmit={(e) => { e.preventDefault(); if (pendente || enviar.isPending || confirmado !== fotografia) return;
    try { const comando = comandoSchema.parse({ requestId: crypto.randomUUID(), listaId, expectedRevision: revisao,
      linhas: descricoes.map((descricao, indice) => ({ descricao, quantidade: detalhes[indice]?.quantidade.trim() || null, unidade: detalhes[indice]?.unidade.trim() || null })) });
      // Margem para os espaços acrescentados na representação JSONB do banco.
      if (new TextEncoder().encode(JSON.stringify(comando.linhas)).length > 64000) {
        setMensagem("A lista pública é muito grande. Reduza as descrições ou divida o conteúdo antes de publicar."); return;
      }
      registrar(comando); }
    catch { setMensagem("Informe de 1 a 100 linhas públicas válidas."); }
  }}>
    <h5>Publicar lista no Portal</h5>
    <p>Redija uma descrição pública por linha. Não inclua custos, fornecedor interno, comprovantes ou informações privadas. Texto interno não é publicado automaticamente.</p>
    <fieldset disabled={!!pendente || enviar.isPending}>
      <label>Linhas públicas <textarea value={texto} onChange={(e) => atualizarTexto(e.target.value)} maxLength={60000} /></label>
      {descricoes.length > 0 && descricoes.length <= 100 && <fieldset><legend>Quantidades e unidades públicas opcionais</legend>
        <p>Quantidades e unidades permanecem nas descrições únicas que não mudaram. Confira novamente as linhas alteradas ou repetidas.</p>
        {descricoes.map((descricao, indice) => <div key={indice}><p>{indice + 1}. {descricao}</p>
          <label>Quantidade da linha {indice + 1} <input maxLength={100} value={detalhes[indice]?.quantidade ?? ""} onChange={e => { setDetalhes(atual => ({ ...atual, [indice]: { quantidade: e.target.value, unidade: atual[indice]?.unidade ?? "" } })); setConfirmado(null); }} /></label>
          <label>Unidade da linha {indice + 1} <input maxLength={100} value={detalhes[indice]?.unidade ?? ""} onChange={e => { setDetalhes(atual => ({ ...atual, [indice]: { quantidade: atual[indice]?.quantidade ?? "", unidade: e.target.value } })); setConfirmado(null); }} /></label>
        </div>)}
      </fieldset>}
      <label><input type="checkbox" checked={confirmado === fotografia} onChange={(e) => setConfirmado(e.target.checked ? fotografia : null)} /> Revisei cada linha e autorizo sua publicação ao Cliente.</label>
      <button type="submit" disabled={confirmado !== fotografia}>Publicar versão</button>
    </fieldset>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
