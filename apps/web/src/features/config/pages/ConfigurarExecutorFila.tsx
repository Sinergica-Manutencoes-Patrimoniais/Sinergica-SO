import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const pedidoSchema = z.object({ atorId: z.string().guid(), requestId: z.string().guid(), revisao: z.number().int().positive(), habilitado: z.boolean(), intervalo: z.number().int().min(5).max(10080), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function ConfigurarExecutorFila({ userId }: { userId: string }) {
  const chave = `sso-config-executor-fila:${userId}`; const trava = useRef(false); const client = useQueryClient();
  const [habilitado, setHabilitado] = useState(false); const [intervalo, setIntervalo] = useState("60"); const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const texto = sessionStorage.getItem(chave); if (!texto) return null; const p = pedidoSchema.parse(JSON.parse(texto)); return p.atorId === userId ? p : "invalido"; } catch { return "invalido"; } });
  async function sessao() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId) throw new Error("Sessão alterada."); }
  const consulta = useQuery({ queryKey: ["config-executor-fila", userId], gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    await sessao(); const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_config_executor_fila", { p_ator_id: userId }).abortSignal(signal);
    if (error) throw error; const r = z.object({ revisao: z.number().int().positive(), habilitado: z.boolean(), intervaloMinutos: z.number().int().min(5).max(10080) }).strict().parse(data);
    await sessao(); if (signal.aborted) throw new Error("Consulta cancelada."); return r;
  } });
  const foto = JSON.stringify([userId, consulta.data, habilitado, intervalo, motivo.trim()]);
  async function finalizar(p: Pedido, mensagem: string) { try {
    await client.invalidateQueries({ queryKey: ["config-executor-fila", userId], refetchType: "none" }); await sessao();
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave);
    setPendente(null); setConfirmado(null); setAviso(mensagem);
    void client.refetchQueries({ queryKey: ["config-executor-fila", userId], type: "active" });
    void client.invalidateQueries({ queryKey: ["config-diagnostico-executor-fila", userId] });
  } catch { setAviso("Configuração confirmada, mas tentativa local não foi limpa. Consulte suporte."); } }
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_configurar_executor_fila", { p_ator_id: userId, p_request_id: p.requestId, p_revisao: p.revisao, p_habilitado: p.habilitado, p_intervalo: p.intervalo, p_motivo: p.motivo });
    if (error) throw error;
    const r = z.object({ requestId: z.string().guid(), revisao: z.number().int().positive(), habilitado: z.boolean(), intervaloMinutos: z.number().int(), cronCriado: z.literal(false), efeitoRemotoComprovado: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.revisao !== p.revisao + 1 || r.habilitado !== p.habilitado || r.intervaloMinutos !== p.intervalo) throw new Error("Resposta divergente."); await sessao();
  }, onSuccess: async (_data, p) => finalizar(p, "Configuração registrada; nenhum cron foi criado."),
  onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."), onSettled: () => { trava.current = false; } });
  const recibo = useMutation({ mutationFn: async (p: Pedido) => {
    await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_config_executor_fila", { p_ator_id: userId, p_request_id: p.requestId, p_revisao: p.revisao, p_habilitado: p.habilitado, p_intervalo: p.intervalo, p_motivo: p.motivo });
    if (error) throw error;
    const r = z.object({ requestId: z.string().guid(), revisao: z.number().int().positive(), habilitado: z.boolean(), intervaloMinutos: z.number().int(), cronCriado: z.literal(false), efeitoRemotoComprovado: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.revisao !== p.revisao + 1 || r.habilitado !== p.habilitado || r.intervaloMinutos !== p.intervalo) throw new Error("Recibo divergente.");
    await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
  }, onSuccess: async (_data, p) => finalizar(p, "Alteração confirmada; o recibo não informa se houve execução."),
    onError: () => setAviso("Confirmação indisponível. A tentativa foi preservada; ausência de recibo não comprova falha."), onSettled: () => { trava.current = false; } });
  function enviar(p: Pedido, repeticao: boolean) { if (trava.current) return; trava.current = true; try { const salvo = sessionStorage.getItem(chave);
    if (repeticao ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error(); if (!repeticao) sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); envio.mutate(p);
  } catch { trava.current = false; setAviso("Não foi possível preservar a tentativa; nada enviado."); } }
  return <section aria-label="Configuração do executor de fila"><h4>Configuração do executor</h4>
    <p>Esta configuração não cria agendamento. Se um agendador já existir, habilitar poderá permitir execuções futuras.</p>
    {consulta.isFetching && <output>Consultando configuração…</output>}{consulta.isError && <p role="alert">Configuração indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <p>Atual: {consulta.data.habilitado ? "habilitado" : "desabilitado"} · {consulta.data.intervaloMinutos} min · revisão {consulta.data.revisao}.</p>}
    {pendente === "invalido" ? <p role="alert">Tentativa local ilegível. Consulte suporte.</p> : pendente ? <><button type="button" disabled={envio.isPending || recibo.isPending} onClick={() => enviar(pendente, true)}>Repetir tentativa</button>
      {import.meta.env.VITE_SSO_RECIBO_CONFIG_EXECUTOR_ENABLED === "true" && <button type="button" disabled={envio.isPending || recibo.isPending} onClick={() => { if (trava.current) return; trava.current = true; recibo.mutate(pendente); }}>Consultar confirmação</button>}</> : <form onSubmit={(e) => { e.preventDefault(); if (!consulta.data || consulta.isFetching || consulta.isError || confirmado !== foto) return;
      const p = pedidoSchema.safeParse({ atorId: userId, requestId: crypto.randomUUID(), revisao: consulta.data.revisao, habilitado, intervalo: Number(intervalo), motivo }); if (p.success) enviar(p.data, false); else setAviso("Confira intervalo e motivo."); }}>
      <label><input type="checkbox" checked={habilitado} onChange={(e) => { setHabilitado(e.target.checked); setConfirmado(null); }} /> Habilitar executor</label>
      <label>Intervalo em minutos <input type="number" min="5" max="10080" required value={intervalo} onChange={(e) => { setIntervalo(e.target.value); setConfirmado(null); }} /></label>
      <label>Motivo <textarea maxLength={2000} required value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmado(null); }} /></label>
      <label><input type="checkbox" checked={confirmado === foto} disabled={!consulta.data || consulta.isFetching || consulta.isError} onChange={(e) => setConfirmado(e.target.checked ? foto : null)} /> Conferi a configuração e seus efeitos.</label>
      <button type="submit" disabled={!consulta.data || consulta.isFetching || consulta.isError || envio.isPending || confirmado !== foto}>Salvar configuração</button>
    </form>}{aviso && <p role="status">{aviso}</p>}
    {import.meta.env.VITE_SSO_HISTORICO_CONFIG_EXECUTOR_ENABLED === "true" && <HistoricoExecutor userId={userId} />}
  </section>;
}

function HistoricoExecutor({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false);
  const linha = z.object({ request_id: z.string().guid(), ator_id: z.string().guid(), revisao: z.number().int().positive(), habilitado: z.boolean(), intervalo_minutos: z.number().int().min(5).max(10080), motivo: z.string().min(1).max(2000), criado_em: z.string().datetime({ offset: true }) }).strict();
  type Cursor = { data: string; request: string } | null;
  const q = useInfiniteQuery({ queryKey: ["config-executor-fila", userId, "historico"], enabled: aberto, gcTime: 0, retry: false, initialPageParam: null as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_historico_config_executor_fila", { p_ator_id: userId, p_antes: pageParam?.data ?? null, p_antes_request: pageParam?.request ?? null, p_limite: 20 }).abortSignal(signal);
      if (error) throw error; const linhas = z.array(linha).max(20).parse(data);
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return linhas;
    }, getNextPageParam: (pagina): Cursor | undefined => { const ultima = pagina.length === 20 ? pagina.at(-1) : undefined; return ultima ? { data: ultima.criado_em, request: ultima.request_id } : undefined; } });
  const linhas = q.data?.pages.flat() ?? [];
  const repetido = new Set(linhas.map((item) => item.request_id)).size !== linhas.length;
  return <section aria-label="Histórico da configuração do executor"><button type="button" aria-expanded={aberto} onClick={() => setAberto(v => !v)}>{aberto ? "Ocultar histórico" : "Consultar histórico"}</button>
    {aberto && <>{q.isFetching && <output>Consultando histórico…</output>}{q.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
      {repetido && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void q.refetch()}>Atualizar</button></p>}
      {!q.isFetching && !q.isError && !repetido && q.data && <><ol>{linhas.map((item) => <li key={item.request_id}>Revisão {item.revisao} · {item.habilitado ? "habilitado" : "desabilitado"} · {item.intervalo_minutos} min · {item.motivo} · responsável {item.ator_id} · <time dateTime={item.criado_em}>{new Date(item.criado_em).toLocaleString("pt-BR")}</time></li>)}</ol>{!linhas.length && <p>Nenhuma alteração registrada.</p>}</>}
      {q.hasNextPage && <button type="button" disabled={q.isFetching || repetido} onClick={() => void q.fetchNextPage()}>Mais alterações</button>}</>}
  </section>;
}
