import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

type Props = { userId: string; clienteId: string; planoId: string };
const pedidoSchema = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), planoId: z.string().uuid(), revisao: z.number().int().nonnegative().safe(), fuso: z.string().trim().min(1).max(100), fonte: z.string().trim().min(1).max(500), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const linhaHistorico = z.object({ request_id: z.string().uuid(), revisao: z.number().int().positive().safe(), fuso: z.string().min(1).max(100), fonte: z.string().min(1).max(500), motivo: z.string().min(1).max(2000), ator_id: z.string().uuid(), criado_em: z.string().datetime({ offset: true }), contrato_referencia_id: z.string().uuid().nullable() }).strict();
export function FusoPlanoDeclarado(props: Props) {
  if (import.meta.env.VITE_SSO_FUSO_PLANO_MEDIADO_ENABLED !== "true") return <p>Declaração de fuso indisponível.</p>;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId])} {...props} />;
}
function Conteudo({ userId, clienteId, planoId }: Props) {
  const cache = useQueryClient(), trava = useRef(false), chave = `sso-fuso-plano:${JSON.stringify([userId, clienteId, planoId])}`;
  const [busca, setBusca] = useState(""), [termo, setTermo] = useState(""), [fuso, setFuso] = useState(""), [fonte, setFonte] = useState(""), [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null), [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw));
    return p.clienteId === clienteId && p.planoId === planoId ? p : "invalido";
  } catch { return "invalido"; } });
  const fusos = useInfiniteQuery({ queryKey: ["fusos-iana-plano", userId, clienteId, planoId, termo], enabled: termo.length >= 2, initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => { await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_fusos_mediado", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_busca: termo, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(z.object({ fuso: z.string().min(1).max(100) }).strict()).max(30).parse(data);
      if (pagina.some((item) => item.fuso === pageParam) || new Set(pagina.map((item) => item.fuso)).size !== pagina.length) throw new Error("Página divergente.");
      await conferirSessaoDiagnostico(userId, signal); return pagina;
    }, getNextPageParam: (p) => p.length === 30 ? p.at(-1)?.fuso : undefined });
  const historico = useInfiniteQuery({ queryKey: ["historico-fuso-plano", userId, clienteId, planoId], initialPageParam: null as number | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => { await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_historico_fuso_mediado", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_antes: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linhaHistorico).max(20).parse(data); let anterior = pageParam ?? Number.MAX_SAFE_INTEGER;
      for (const item of pagina) { if (item.revisao >= anterior) throw new Error("Página divergente."); anterior = item.revisao; }
      await conferirSessaoDiagnostico(userId, signal); return pagina;
    }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.revisao : undefined });
  const itensFuso = fusos.data?.pages.flat() ?? [], itensHistorico = historico.data?.pages.flat() ?? [];
  const divergente = new Set(itensFuso.map((x) => x.fuso)).size !== itensFuso.length || itensHistorico.some((x, i) => i > 0 && x.revisao >= itensHistorico[i - 1]!.revisao) || new Set(itensHistorico.map((x) => x.request_id.toLowerCase())).size !== itensHistorico.length;
  const disponivel = !divergente && !historico.isFetching && !historico.isError && !fusos.isFetching && !fusos.isError;
  const revisao = itensHistorico[0]?.revisao ?? 0;
  const foto = JSON.stringify([userId, clienteId, planoId, revisao, fuso, fonte.trim(), motivo.trim()]);
  const envio = useMutation({ mutationFn: async (p: Pedido) => { await conferirSessaoDiagnostico(userId);
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_declarar_fuso_mediado", { p_ator_id: userId, p_request_id: p.requestId, p_cliente_id: p.clienteId, p_plano_id: p.planoId, p_expected_revision: p.revisao, p_fuso: p.fuso, p_contrato_referencia_id: null, p_fonte: p.fonte, p_motivo: p.motivo });
    if (error) throw error;
    const r = z.object({ requestId: z.string().uuid(), planoId: z.string().uuid(), revisao: z.number().int().positive().safe(), fusoDeclarado: z.string(), contratoReferenciaId: z.null(), fonteValidada: z.literal(false), geracaoAlterada: z.literal(false), vinculoContratualComprovado: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.planoId !== p.planoId || r.revisao !== p.revisao + 1 || r.fusoDeclarado !== p.fuso) throw new Error("Recibo divergente.");
    await conferirSessaoDiagnostico(userId); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
  }, onSuccess: async (_data, p) => { try { await cache.invalidateQueries({ queryKey: ["historico-fuso-plano", userId, clienteId, planoId], refetchType: "none" });
    await conferirSessaoDiagnostico(userId); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave);
  } catch { setAviso("Declaração confirmada, mas tentativa local não foi removida. Consulte suporte."); return; }
    setPendente(null); setConfirmacao(null); setAviso("Fuso declarado; geração continua inalterada e fonte não validada.");
    void Promise.allSettled([
      cache.refetchQueries({ queryKey: ["historico-fuso-plano", userId, clienteId, planoId], type: "active" }),
      cache.invalidateQueries({ queryKey: ["preflight-aprovacao-revisao", userId, clienteId, planoId] }),
      cache.invalidateQueries({ queryKey: ["conferencia-fuso-series", userId, clienteId, planoId] }),
    ]);
  }, onError: () => setAviso("Resultado não confirmado ou revisão mudou. Repita a mesma tentativa; procure suporte em conflito."), onSettled: () => { trava.current = false; } });
  function enviar(p: Pedido, repetir = false) { if (trava.current) return; try { const salvo = sessionStorage.getItem(chave);
    if (repetir ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error(); if (!repetir) sessionStorage.setItem(chave, JSON.stringify(p));
    setPendente(p); trava.current = true; envio.mutate(p);
  } catch { setAviso("Tentativa indisponível ou divergente; nada foi enviado."); } }
  return <section aria-label="Fuso declarado do Plano"><h4>Fuso declarado do Plano</h4><p>A escolha IANA e sua fonte são declaração do PCM, não validação contratual. Ainda não altera geração, aprovação ou vencidos; não há contrato vinculado por esta tela.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (busca.trim().length >= 2) { setTermo(busca.trim()); setFuso(""); setConfirmacao(null); } }}><label>Buscar fuso IANA <input minLength={2} maxLength={100} value={busca} onChange={(e) => setBusca(e.target.value)} /></label><button disabled={!!pendente}>Buscar</button></form>
    {fusos.isError && <p role="alert">Lista de fusos indisponível. <button type="button" onClick={() => void fusos.refetch()}>Tentar novamente</button></p>}
    {historico.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
    {divergente && <p role="alert">Páginas divergentes. <button type="button" onClick={() => { void fusos.refetch(); void historico.refetch(); }}>Atualizar consultas</button></p>}
    {disponivel && historico.data && <form onSubmit={(e) => { e.preventDefault(); if (pendente || confirmacao !== foto || !itensFuso.some((x) => x.fuso === fuso)) return;
      const p = pedidoSchema.safeParse({ requestId: crypto.randomUUID(), clienteId, planoId, revisao, fuso, fonte: fonte.trim(), motivo: motivo.trim() });
      if (!p.success) { setAviso("Confira os dados antes de enviar."); return; } enviar(p.data); }}><fieldset disabled={!!pendente || envio.isPending}>
      <label>Fuso <select required value={fuso} onChange={(e) => { setFuso(e.target.value); setConfirmacao(null); }}><option value="">Selecione</option>{itensFuso.map((x) => <option key={x.fuso} value={x.fuso}>{x.fuso}</option>)}</select></label>
      <label>Fonte declarada <input required maxLength={500} value={fonte} onChange={(e) => { setFonte(e.target.value); setConfirmacao(null); }} /></label>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === foto} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} /> Confirmo a declaração, sem ativar geração</label><button disabled={confirmacao !== foto}>Registrar fuso</button></fieldset></form>}
    {disponivel && fusos.hasNextPage && <button type="button" onClick={() => void fusos.fetchNextPage()}>Mais fusos</button>}
    <h5>Histórico</h5>{disponivel && <ul>{itensHistorico.map((h) => <li key={h.request_id}>Revisão {h.revisao} · {h.fuso} · {h.fonte} · {h.motivo} · referência contrato {h.contrato_referencia_id ?? "não informada"} · {h.ator_id} · {h.criado_em}</li>)}</ul>}
    {disponivel && historico.hasNextPage && <button type="button" onClick={() => void historico.fetchNextPage()}>Mais histórico</button>}
    {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>Repetir tentativa pendente</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
