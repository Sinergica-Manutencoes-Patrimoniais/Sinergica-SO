import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const esquema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("publicar"), requestId: z.string().guid(), publicacaoId: z.string().guid(), notaId: z.string().guid(), titulo: z.string().trim().min(1).max(300) }).strict(),
  z.object({ acao: z.literal("revogar"), requestId: z.string().guid(), revogacaoId: z.string().guid(), publicacaoId: z.string().guid(), motivo: z.string().trim().min(1).max(2000) }).strict(),
]);
type Pedido = z.infer<typeof esquema>;
type Props = { usuario: string; cliente: string; ordemServico: string };
export function PublicarAnexo(props: Props) {
  if (import.meta.env.VITE_SSO_PUBLICAR_ANEXO_OS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.ordemServico])} {...props} />;
}
function Conteudo({ usuario, cliente, ordemServico }: Props) {
  const chave = `sso-publicar-anexo:${usuario}:${cliente}:${ordemServico}`; const queryClient = useQueryClient();
  const [selecionada, setSelecionada] = useState(""); const [titulo, setTitulo] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false); const [mensagem, setMensagem] = useState(""); const [baixando, setBaixando] = useState(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); return salvo ? esquema.parse(JSON.parse(salvo)) : null; }
    catch { return "invalido"; }
  });
  const notas = useInfiniteQuery({ queryKey: ["publicar-anexos-os", usuario, cliente, ordemServico], gcTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_anexos_os_para_publicacao", {
        p_cliente_id: cliente, p_os_id: ordemServico, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(z.object({ nota_id: z.string().guid(), criado_em: z.string(), publicacao_id: z.string().guid().nullable() }).strict()).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.nota_id : undefined });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    const chamada = p.acao === "publicar" ? await supabase.schema("pcm").rpc("sso_publicar_anexo_os", {
      p_request_id: p.requestId, p_publicacao_id: p.publicacaoId, p_nota_id: p.notaId, p_titulo: p.titulo }) :
      await supabase.schema("pcm").rpc("sso_revogar_anexo_os", { p_request_id: p.requestId, p_revogacao_id: p.revogacaoId, p_publicacao_id: p.publicacaoId, p_motivo: p.motivo });
    if (chamada.error) throw chamada.error;
    const r = chamada.data;
    if (!r || r.requestId !== p.requestId || r.aggregateId !== (p.acao === "publicar" ? p.publicacaoId : p.revogacaoId) ||
      r.state !== (p.acao === "publicar" ? "publicado" : "revogado")) throw new Error("Resposta inválida.");
  }, onSuccess: async () => { try { sessionStorage.removeItem(chave); } catch { setMensagem("Operação salva; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setConfirmado(false); setMensagem("Operação registrada.");
    await queryClient.invalidateQueries({ queryKey: ["publicar-anexos-os", usuario, cliente, ordemServico] }); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."), });
  function registrar(p: Pedido) { try { sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setMensagem("Não foi possível guardar tentativa; operação não enviada."); return; }
    setPendente(p); setMensagem(""); enviar.mutate(p); }
  async function revisar() {
    if (!selecionada || baixando) return; setBaixando(true); setMensagem("");
    try { const { data, error } = await supabase.functions.invoke<Blob>("revisao-anexo-os-seguro", { body: { lancamentoId: selecionada } });
      if (error) throw error; if (!(data instanceof Blob)) throw new Error("Resposta inválida.");
      const endereco = URL.createObjectURL(data); const link = document.createElement("a"); link.href = endereco; link.download = "anexo-para-revisao"; link.click();
      setTimeout(() => URL.revokeObjectURL(endereco), 1000);
    } catch { setMensagem("Não foi possível baixar arquivo para revisão."); } finally { setBaixando(false); }
  }
  const nota = notas.data?.pages.flat().find((n) => n.nota_id === selecionada);
  return <section aria-label="Publicar anexos da OS"><h4>Publicar anexo no Portal</h4>
    <p>Baixe e revise integralmente o arquivo. Não publique conteúdo com custos, dados pessoais indevidos ou comprovantes financeiros.</p>
    {notas.isError && <p role="alert">Não foi possível consultar anexos autorizados.</p>}
    <fieldset disabled={!!pendente || enviar.isPending || notas.isPending || notas.isError}>
      <label>Anexo da nota <select value={selecionada} onChange={(e) => { setSelecionada(e.target.value); setConfirmado(false); }}>
        <option value="">Selecione</option>{notas.data?.pages.flat().map((n) => <option key={n.nota_id} value={n.nota_id}>{n.nota_id} · {new Date(n.criado_em).toLocaleString("pt-BR")} {n.publicacao_id ? "· publicado" : ""}</option>)}</select></label>
      {notas.hasNextPage && <button type="button" onClick={() => void notas.fetchNextPage()}>Mais anexos</button>}
      <button type="button" disabled={!nota || baixando} onClick={() => void revisar()}>Baixar para revisão</button>
      {!nota?.publicacao_id && <><label>Título público <input maxLength={300} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
        <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Revisei todo o conteúdo e autorizo publicação.</label>
        <button type="button" disabled={!nota || !confirmado} onClick={() => { try { registrar(esquema.parse({ acao: "publicar", requestId: crypto.randomUUID(), publicacaoId: crypto.randomUUID(), notaId: selecionada, titulo })); } catch { setMensagem("Confira anexo e título público."); } }}>Publicar</button></>}
      {nota?.publicacao_id && <><label>Motivo da retirada <textarea maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Confirmo a retirada.</label>
        <button type="button" disabled={!confirmado} onClick={() => { try { registrar(esquema.parse({ acao: "revogar", requestId: crypto.randomUUID(), revogacaoId: crypto.randomUUID(), publicacaoId: nota.publicacao_id, motivo })); } catch { setMensagem("Informe o motivo da retirada."); } }}>Retirar publicação</button></>}
    </fieldset>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
