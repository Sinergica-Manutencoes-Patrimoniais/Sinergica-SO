import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

const cicloSchema = z.array(z.object({ revisao: z.number().int().positive(), codigo: z.string().nullable(),
  aprovado_em: z.string().nullable(), sincronizado_em: z.string().nullable(), etiquetado_em: z.string().nullable(), referenciado_os_em: z.string().nullable() }).strict()).length(1);
const pedidoSchema = z.object({ requestId: z.string().uuid(), tipo: z.enum(["sistema", "componente"]), ativoId: z.string().uuid(),
  revision: z.number().int().positive(), anterior: z.string().nullable(), novo: z.string().min(1).max(200).regex(/^\S+$/) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; tipo: "sistema" | "componente"; ativoId: string; onAtualizado?: () => void };
export function EdicaoRascunhoCodigo(props: Props) {
  if (import.meta.env.VITE_SSO_CODIGO_RASCUNHO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.tipo, props.ativoId])} {...props} />;
}
function Conteudo({ userId, clienteId, tipo, ativoId, onAtualizado }: Props) {
  const chave = `sso-codigo-rascunho:${JSON.stringify([userId, clienteId, tipo, ativoId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const valor = sessionStorage.getItem(chave); if (!valor) return null;
    const p = pedidoSchema.parse(JSON.parse(valor)); return p.tipo === tipo && p.ativoId === ativoId ? p : "invalido";
  } catch { return "invalido"; } });
  const [novo, setNovo] = useState(""); const [aviso, setAviso] = useState(""); const trava = useRef(false); const client = useQueryClient();
  const permissao = useQuery({ queryKey: ["codigos-publicos",userId,clienteId,"rascunho-permissao"],
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.gerir",clienteId), gcTime: 0, refetchOnWindowFocus: true });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const ciclo = useQuery({ queryKey: ["codigos-publicos",userId,clienteId,tipo,ativoId,"ciclo"], enabled: permitido, gcTime: 0,
    queryFn: async ({ signal }) => { const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");const { data, error } = await supabase.schema("pcm").rpc("sso_mediar_consulta_codigo_rascunho", { p_cliente_id: clienteId, p_tipo: tipo, p_ativo_id: ativoId }).abortSignal(signal);
      if (error) throw error; const resultado=cicloSchema.parse(data)[0];const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return resultado; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_mediar_edicao_codigo_rascunho", { p_cliente_id: clienteId, p_request_id: p.requestId, p_tipo: p.tipo,
      p_ativo_id: p.ativoId, p_expected_revision: p.revision, p_codigo_anterior: p.anterior, p_codigo_novo: p.novo });
    if (error) throw error;
    const resposta = z.object({ ativoId: z.string().uuid(), tipo: z.enum(["sistema","componente"]), codigoAtual: z.string(), revision: z.number().int(), requestId: z.string().uuid() }).strict().parse(data);
    if (resposta.ativoId !== p.ativoId || resposta.tipo !== p.tipo || resposta.codigoAtual !== p.novo || resposta.revision !== p.revision+1 || resposta.requestId !== p.requestId) throw new Error("Resposta divergente");
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
  }, onSuccess: async (_r,p) => {
    await client.invalidateQueries({ queryKey: ["codigos-publicos",userId,clienteId] });
    await client.invalidateQueries({ queryKey: ["pcm","ativos-cliente",clienteId] });
    try { const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Código alterado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setNovo(""); setAviso("Código de rascunho alterado."); onAtualizado?.();
  }, onError: () => setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."), onSettled: () => { trava.current = false; } });
  function enviar(p: Pedido) { if (!permitido || trava.current) return; try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();}catch{setAviso("Tentativa alterada; consulte suporte.");return;}trava.current = true; envio.mutate(p); }
  function iniciar() { if (!ciclo.data || ciclo.isFetching || ciclo.isError || pendente || trava.current || ciclo.data.aprovado_em || ciclo.data.sincronizado_em || ciclo.data.etiquetado_em || ciclo.data.referenciado_os_em) return; try {
    const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), tipo, ativoId, revision: ciclo.data.revisao, anterior: ciclo.data.codigo, novo: novo.trim().toUpperCase() });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); enviar(p);
  } catch { setAviso("Confira o código e a sessão. Nada foi enviado."); } }
  if (permissao.isPending || permissao.isFetching) return <output>Verificando permissão de código…</output>;
  if (permissao.isError) return <p role="alert">Não foi possível verificar permissão. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (!permitido) return null;
  const cicloAtual = !ciclo.isFetching && !ciclo.isError ? ciclo.data : undefined;
  const protegido = !!(cicloAtual?.aprovado_em || cicloAtual?.sincronizado_em || cicloAtual?.etiquetado_em || cicloAtual?.referenciado_os_em);
  const marcos = [
    ["Aprovado", cicloAtual?.aprovado_em ?? null], ["Sincronizado", cicloAtual?.sincronizado_em ?? null],
    ["Etiquetado", cicloAtual?.etiquetado_em ?? null], ["Referenciado em OS", cicloAtual?.referenciado_os_em ?? null],
  ] as const;
  return <section><h3>Código de rascunho</h3>
    {ciclo.isFetching && <output>Consultando ciclo do código…</output>}
    {ciclo.isError && <p role="alert">Ciclo indisponível ou não autorizado. <button type="button" onClick={()=>void ciclo.refetch()}>Tentar novamente</button></p>}
    {cicloAtual && <p>Código atual: {cicloAtual.codigo ?? "não informado"}. A autorização e o uso serão verificados novamente no servidor.</p>}
    {protegido && <p>Código protegido por marco de uso; edição comum indisponível.</p>}
    {protegido && <ul aria-label="Marcos de proteção do código">{marcos.filter(([, data]) => data !== null).map(([nome, data]) => <li key={nome}>{nome}: {data}</li>)}</ul>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa</button> :
      !pendente && cicloAtual && !protegido && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}><label>Novo código <input required maxLength={200} value={novo} onChange={(e) => setNovo(e.target.value)} /></label><button type="submit" disabled={envio.isPending}>Alterar código</button></form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
