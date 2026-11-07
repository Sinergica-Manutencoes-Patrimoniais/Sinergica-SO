import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { useAreasDoCliente, useLocaisDoCliente } from "../../application/ativos-cliente-queries";
import { supabaseHierarquiaAdapter } from "../../infrastructure/supabase-hierarquia-adapter";

export const pedidoVinculoLocalizacaoSchema = z.object({ requestId: z.string().guid(), loteId: z.string().guid(), chave: z.string().min(1).max(200), revisao: z.number().int().positive(),
  tipo: z.enum(["area", "local", "sublocal"]), entidadeId: z.string().guid(), snapshot: z.record(z.string(), z.unknown()), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoVinculoLocalizacaoSchema>;
type Props = { userId: string; clienteId: string; loteId: string; chave: string; revisao: number; tipo: string };

export function VincularLocalizacao(props: Props) {
  if (import.meta.env.VITE_SSO_VINCULAR_LOCALIZACAO_ENABLED !== "true" || !["area", "local", "sublocal"].includes(props.tipo)) return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.loteId, props.chave])} {...props} />;
}

function Conteudo({ userId, clienteId, loteId, chave, revisao, tipo }: Props) {
  const storage = `sso-vincular-localizacao:${JSON.stringify([userId, clienteId, loteId, chave])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(storage); if (!salvo) return null; const p = pedidoVinculoLocalizacaoSchema.parse(JSON.parse(salvo));
      return p.loteId === loteId && p.chave === chave && p.tipo === tipo ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [entidade, setEntidade] = useState(""); const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState(""); const [consultando, setConsultando] = useState(false); const trava = useRef(false); const cache = useQueryClient();
  const areas = useAreasDoCliente(supabaseHierarquiaAdapter, clienteId); const locais = useLocaisDoCliente(supabaseHierarquiaAdapter, clienteId);
  const opcoes = tipo === "area" ? (areas.data ?? []).filter((x) => x.ativo).map((x) => ({ id: x.id, nome: x.nome }))
    : (locais.data ?? []).filter((x) => x.ativo && (tipo === "local" ? x.parentId === null : x.parentId !== null)).map((x) => ({ id: x.id, nome: x.nome }));
  async function conferirSessao() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada."); }
  const snapshot = useQuery({ queryKey: ["levantamentos", userId, clienteId, loteId, chave, "vinculo-localizacao", entidade, revisao], enabled: !!entidade, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { await conferirSessao(); const { data, error } = await supabase.schema("pcm").rpc("sso_snapshot_localizacao_autorizado", { p_cliente_id: clienteId, p_tipo: tipo, p_entidade_id: entidade }).abortSignal(signal);
      if (error) throw error; const r = z.record(z.string(), z.unknown()).parse(data); if (r.id !== entidade || typeof r.nome !== "string") throw new Error("Cadastro divergente.");
      await conferirSessao(); if (signal.aborted) throw new Error("Consulta cancelada."); return r; } });
  const fotografia = snapshot.data && !snapshot.isFetching && !snapshot.isError ? JSON.stringify([userId, clienteId, loteId, chave, revisao, tipo, entidade, snapshot.data, motivo.trim()]) : null;
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao(); if (sessionStorage.getItem(storage) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_vincular_localizacao_existente", { p_request_id: p.requestId, p_lote_id: p.loteId,
      p_expected_revision: p.revisao, p_chave: p.chave, p_entidade_id: p.entidadeId, p_snapshot: p.snapshot, p_motivo: p.motivo });
    if (error) throw error;
    const r = z.object({ requestId: z.string().guid(), aggregateId: z.string().guid(), revision: z.number().int().positive(), state: z.literal("pendente"), created: z.literal(false),
      linkedIds: z.object({ entidadeId: z.string().guid(), tipo: z.string() }).strict(), warnings: z.array(z.string()) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.aggregateId !== p.loteId || r.revision !== p.revisao + 1 || r.linkedIds.entidadeId !== p.entidadeId || r.linkedIds.tipo !== p.tipo) throw new Error("Resposta divergente.");
    await conferirSessao();
  }, onSuccess: async (_r, p) => { try {
    await cache.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId], refetchType: "none" }); await conferirSessao();
    if (sessionStorage.getItem(storage) !== JSON.stringify(p)) throw new Error("Tentativa alterada."); sessionStorage.removeItem(storage);
    setPendente(null); setConfirmacao(null); setAviso("Localização vinculada sem alteração do cadastro oficial.");
    void cache.refetchQueries({ queryKey: ["levantamentos", userId, clienteId], type: "active" });
  } catch { setAviso("Resultado confirmado, mas tentativa local não pôde ser limpa. Consulte suporte."); } },
    onError: () => setAviso("Resultado não confirmado. Repita o mesmo pedido ou consulte suporte."), onSettled: () => { trava.current = false; } });
  function enviar(p: Pedido) { if (trava.current) return; trava.current = true; envio.mutate(p); }
  async function consultarRecibo(p: Pedido) {
    if (trava.current) return; trava.current = true; setConsultando(true); setAviso("");
    try {
      await conferirSessao(); if (sessionStorage.getItem(storage) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      const payload = { operacao: "vincular_localizacao", loteId: p.loteId.toLowerCase(), expectedRevision: p.revisao,
        chave: p.chave, entidadeId: p.entidadeId.toLowerCase(), snapshot: p.snapshot, motivo: p.motivo.trim() };
      const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_vinculo_localizacao", {
        p_ator_id: userId, p_cliente_id: clienteId, p_request_id: p.requestId, p_lote_id: p.loteId, p_chave: p.chave, p_payload: payload,
      });
      if (error) throw error;
      const r = z.object({ requestId: z.string().guid(), aggregateId: z.string().guid(), revision: z.number().int().positive(), state: z.literal("pendente"), created: z.literal(false),
        linkedIds: z.object({ entidadeId: z.string().guid(), tipo: z.string() }).strict(), warnings: z.array(z.string()) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.aggregateId !== p.loteId || r.revision !== p.revisao + 1 || r.linkedIds.entidadeId !== p.entidadeId || r.linkedIds.tipo !== p.tipo) throw new Error("Recibo divergente.");
      await cache.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId], refetchType: "none" }); await conferirSessao();
      if (sessionStorage.getItem(storage) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(storage); setPendente(null); setConfirmacao(null); setAviso("Vínculo confirmado sem alteração do cadastro oficial.");
      void cache.refetchQueries({ queryKey: ["levantamentos", userId, clienteId], type: "active" });
    } catch { setAviso("Recibo indisponível. A tentativa foi preservada; isso não prova falha."); }
    finally { trava.current = false; setConsultando(false); }
  }
  function iniciar() {
    if (pendente || trava.current || !fotografia || confirmacao !== fotografia || !snapshot.data || !motivo.trim() || areas.isFetching || locais.isFetching || areas.isError || locais.isError || !opcoes.some((x) => x.id === entidade)) return;
    try { const p = pedidoVinculoLocalizacaoSchema.parse({ requestId: crypto.randomUUID(), loteId, chave, revisao, tipo, entidadeId: entidade, snapshot: snapshot.data, motivo });
      if (sessionStorage.getItem(storage) !== null) throw new Error("Tentativa existente."); sessionStorage.setItem(storage, JSON.stringify(p)); setPendente(p); enviar(p);
    } catch { setAviso("Confira seleção, motivo e armazenamento. Nada foi enviado."); }
  }
  return <section aria-label={`Vincular localização da linha ${chave}`}><h5>Vincular localização existente</h5>
    <p>O cadastro não será alterado. Nome e pai devem corresponder à linha aprovada; os demais campos precisam de tratamento próprio.</p>
    {(areas.isError || locais.isError) && <p role="alert">Cadastros indisponíveis.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <><button type="button" disabled={envio.isPending || consultando} onClick={() => enviar(pendente)}>Repetir vínculo</button>
      {import.meta.env.VITE_SSO_RECIBO_VINCULO_LOCALIZACAO_ENABLED === "true" && <button type="button" disabled={envio.isPending || consultando} onClick={() => void consultarRecibo(pendente)}>Consultar confirmação</button>}</> : !pendente && <>
      <label>Cadastro <select value={entidade} onChange={(e) => { setEntidade(e.target.value); setConfirmacao(null); }}><option value="">Selecione</option>{opcoes.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.id}</option>)}</select></label>
      {entidade && snapshot.isError && <p role="alert">Cadastro indisponível. <button type="button" onClick={() => void snapshot.refetch()}>Tentar novamente</button></p>}
      {snapshot.data && !snapshot.isFetching && <p>Nome: {String(snapshot.data.nome)} · Área: {String(snapshot.data.areaId ?? "—")} · Pai: {String(snapshot.data.parentId ?? "—")}</p>}
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={fotografia !== null && confirmacao === fotografia} disabled={!fotografia || envio.isPending} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi identidade, nome e hierarquia.</label>
      <button type="button" disabled={!fotografia || confirmacao !== fotografia || !motivo.trim() || envio.isPending} onClick={iniciar}>Vincular sem alterar</button>
    </>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
