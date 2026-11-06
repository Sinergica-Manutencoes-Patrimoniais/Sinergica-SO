import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const uuid = z.string().uuid();
const cadastro = z.object({ tipo: z.literal("cadastro"), requestId: uuid, contratoId: uuid, versao: z.string().trim().min(1).max(100),
  definicao: z.record(z.unknown()), motivo: z.string().trim().min(1).max(2000), evidencia: z.string().trim().min(1).max(2000) }).strict();
const mudanca = z.object({ tipo: z.literal("estado"), requestId: uuid, contratoId: uuid, anterior: z.boolean(), habilitar: z.boolean(), motivo: z.string().trim().min(1).max(2000) }).strict().refine((p) => p.anterior !== p.habilitar);
const pedidoSchema = z.union([cadastro, mudanca]);
type Pedido = z.infer<typeof pedidoSchema>;
const item = z.object({ id: uuid, versao: z.string(), habilitado: z.boolean(), definicao: z.record(z.unknown()), motivo: z.string().nullable(), evidencia: z.string().nullable(), criado_por: uuid.nullable() }).strict();

export function ContratosOrigemCampo({ userId }: { userId: string }) {
  if (import.meta.env.VITE_SSO_ADMIN_CONTRATO_ORIGEM_ENABLED !== "true") return null;
  return <Conteudo key={userId} userId={userId} />;
}
function Conteudo({ userId }: { userId: string }) {
  const chave = `sso-contrato-origem-admin:${userId}`;
  const cache = useQueryClient(); const trava = useRef(false);
  const [versao, setVersao] = useState(""); const [definicao, setDefinicao] = useState("");
  const [motivo, setMotivo] = useState(""); const [evidencia, setEvidencia] = useState("");
  const [motivoEstado, setMotivoEstado] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(chave); if (!raw) return null; if (new TextEncoder().encode(raw).length > 70_000) throw new Error(); return pedidoSchema.parse(JSON.parse(raw)); }
    catch { return "invalido"; }
  });
  async function conferirSessao(signal?: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const lista = useInfiniteQuery({ queryKey: ["contratos-origem-campo", userId], gcTime: 0, refetchOnWindowFocus: true,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_contratos_origem", { p_ator_id: userId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error;
      const itens = z.array(item).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? null;
      for (const linha of itens) { const id = linha.id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página inválida."); anterior = id; }
      await conferirSessao(signal); return itens;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const args = p.tipo === "cadastro" ? { p_ator_id: userId, p_request_id: p.requestId, p_contrato_id: p.contratoId, p_versao: p.versao, p_definicao: p.definicao, p_motivo: p.motivo, p_evidencia: p.evidencia }
      : { p_ator_id: userId, p_request_id: p.requestId, p_contrato_id: p.contratoId, p_anterior: p.anterior, p_habilitar: p.habilitar, p_motivo: p.motivo };
    const { data, error } = await supabase.schema("pcm").rpc(p.tipo === "cadastro" ? "sso_cadastrar_contrato_origem" : "sso_alterar_contrato_origem", args);
    if (error || !data || data.requestId !== p.requestId || data.contratoId !== p.contratoId ||
      data.habilitado !== (p.tipo === "cadastro" ? false : p.habilitar) || (p.tipo === "cadastro" ? data.contratoComprovado !== false : data.comprovacaoAutomatica !== false)) throw new Error("Recibo inválido.");
    await conferirSessao(); return data;
  }, onSuccess: async (_r, p) => {
    try { await cache.invalidateQueries({ queryKey: ["contratos-origem-campo", userId], refetchType: "none" }); await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null);
      setAviso("Registro confirmado. Habilitação administrativa não comprova o contrato Auvo nem inicia processamento."); void lista.refetch();
    } catch { setAviso("Não foi possível confirmar a sessão ou a tentativa. Consulte suporte."); }
  }, onError: () => setAviso("Resultado não confirmado. Preserve e repita a mesma tentativa ou consulte suporte."), onSettled: () => { trava.current = false; } });
  function executar(p: Pedido) {
    if (trava.current || lista.isFetching || lista.isError) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); }
    catch { setAviso("Tentativa local divergente."); return; }
    trava.current = true; enviar.mutate(p);
  }
  function iniciar(p: Pedido) {
    if (pendente || trava.current || lista.isFetching || lista.isError) return;
    try { const validado = pedidoSchema.parse(p); const texto = JSON.stringify(validado);
      if (new TextEncoder().encode(texto).length > 70_000 || sessionStorage.getItem(chave)) throw new Error();
      sessionStorage.setItem(chave, texto); setPendente(validado); executar(validado);
    } catch { setAviso("Confira o pedido e o armazenamento. Nada foi enviado."); }
  }
  const itens = !lista.isFetching && !lista.isError ? lista.data?.pages.flat() ?? [] : [];
  return <section aria-label="Contratos de origem de campo">
    <h2>Contratos de origem de campo</h2>
    <p>Mapeamentos são versionados e só aceitam declaração administrativa. Não incluem credenciais; habilitar não comprova o contrato nem inicia processamento.</p>
    {lista.isFetching && <output>Consultando contratos…</output>}
    {lista.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {pendente === "invalido" && <p role="alert">Tentativa local inválida. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={enviar.isPending || lista.isFetching || lista.isError} onClick={() => executar(pendente)}>Repetir mesmo pedido</button> : !pendente && <form onSubmit={(e) => {
      e.preventDefault(); try { iniciar(cadastro.parse({ tipo: "cadastro", requestId: crypto.randomUUID(), contratoId: crypto.randomUUID(), versao, definicao: JSON.parse(definicao), motivo, evidencia })); }
      catch { setAviso("Confira versão, JSON, motivo e evidência. Nada foi enviado."); }
    }}>
      <label>Versão <input required maxLength={100} value={versao} onChange={(e) => setVersao(e.target.value)} /></label>
      <label>Mapeamento JSON <textarea required value={definicao} onChange={(e) => setDefinicao(e.target.value)} /></label>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label>Referência da evidência <textarea required maxLength={2000} value={evidencia} onChange={(e) => setEvidencia(e.target.value)} /></label>
      <button type="submit" disabled={enviar.isPending || lista.isFetching || lista.isError}>Cadastrar desativado</button>
    </form>}
    <ul>{itens.map((c) => { const foto = JSON.stringify([userId, c.id, c.habilitado, motivoEstado.trim()]); return <li key={c.id}>
      Versão {c.versao} · {c.habilitado ? "habilitado" : "desativado"} · {c.id}
      <details><summary>Conferir mapeamento e declaração</summary><pre>{JSON.stringify(c.definicao, null, 2)}</pre><p>Motivo: {c.motivo ?? "não informado"}</p><p>Evidência declarada: {c.evidencia ?? "não informada"}</p></details>
      {!pendente && <><label>Motivo da alteração <input value={motivoEstado} maxLength={2000} onChange={(e) => { setMotivoEstado(e.target.value); setConfirmacao(null); }} /></label>
        <label><input type="checkbox" checked={confirmacao === foto} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} /> Conferi versão, estado e motivo.</label>
        <button type="button" disabled={confirmacao !== foto || !motivoEstado.trim() || enviar.isPending} onClick={() => iniciar({ tipo: "estado", requestId: crypto.randomUUID(), contratoId: c.id, anterior: c.habilitado, habilitar: !c.habilitado, motivo: motivoEstado.trim() })}>{c.habilitado ? "Desativar" : "Habilitar"}</button></>}
    </li>; })}</ul>
    {lista.hasNextPage && !lista.isError && <button type="button" disabled={lista.isFetching} onClick={() => void lista.fetchNextPage()}>Mais contratos</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
