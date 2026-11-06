import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const opcao = z.object({ snapshot_id: uuid, vinculo_evidencia_id: uuid, resposta_id: uuid, evidencia_id: uuid, retorno_id: uuid }).strict();
const pedido = z.object({ requestId: uuid, cliente: uuid, declaracao: uuid, snapshot: uuid, evidencia: uuid, motivo: z.string().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedido>;

export function VinculoRespostaServico(props: { usuario: string; cliente: string; declaracao: string }) {
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.declaracao])} {...props} />;
}
function Conteudo({ usuario, cliente, declaracao }: { usuario: string; cliente: string; declaracao: string }) {
  const chave = `vinculo-resposta-servico:${JSON.stringify([usuario, cliente, declaracao])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedido.parse(JSON.parse(raw)); return p.cliente === cliente && p.declaracao === declaracao ? p : "invalido"; } catch { return "invalido"; } });
  const [escolha, setEscolha] = useState(""); const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState(""); const [enviando, setEnviando] = useState(false); const ocupado = useRef(false); const cache = useQueryClient();
  async function sessao(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada."); }
  const opcoes = useInfiniteQuery({ queryKey: ["opcoes-vinculo-servico", usuario, cliente, declaracao], gcTime: 0, retry: false, initialPageParam: null as string | null, queryFn: async ({ signal, pageParam }) => {
    await sessao(signal); const { data, error } = await supabase.schema("financeiro").rpc("sso_paginar_opcoes_vinculo_servico_mediado", { p_cliente_id: cliente, p_declaracao_id: declaracao, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
    if (error) throw error; const itens = z.array(opcao).max(50).parse(data); let anterior = pageParam?.toLowerCase() ?? "";
    for (const item of itens) { if (item.vinculo_evidencia_id.toLowerCase() <= anterior) throw new Error("Página divergente."); anterior = item.vinculo_evidencia_id.toLowerCase(); }
    await sessao(signal); return itens;
  }, getNextPageParam: (page) => page.length === 50 ? page.at(-1)?.vinculo_evidencia_id : undefined });
  const itens = opcoes.data?.pages.flat() ?? [];
  const consistentes = new Set(itens.map((x) => x.vinculo_evidencia_id.toLowerCase())).size === itens.length;
  const visiveis = !!opcoes.data && !opcoes.isFetching && !opcoes.isError && consistentes;
  const selecionado = visiveis ? itens.find((v) => v.vinculo_evidencia_id === escolha) : undefined;
  const fotografia = selecionado ? JSON.stringify([usuario, cliente, declaracao, selecionado, motivo.trim()]) : null;
  const enviar = async (p: Pedido) => { if (ocupado.current) return; ocupado.current = true; setEnviando(true); try {
    await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("financeiro").rpc("sso_declarar_vinculo_servico_mediado", { p_request_id: p.requestId, p_cliente_id: p.cliente, p_snapshot_id: p.snapshot, p_vinculo_evidencia_id: p.evidencia, p_motivo: p.motivo });
    if (error) throw error; const r = z.object({ requestId: uuid, declarado: z.literal(true), execucaoComprovada: z.literal(false), geraFaturavel: z.literal(false) }).strict().parse(data); if (r.requestId !== p.requestId) throw new Error("Resposta divergente");
    await sessao(); await cache.invalidateQueries({ queryKey: ["opcoes-vinculo-servico", usuario, cliente, declaracao], refetchType: "none" }); await sessao();
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setAviso("Vínculo declarado. Não comprova execução e não gera faturável."); void opcoes.refetch();
  } catch { setAviso("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."); } finally { ocupado.current = false; setEnviando(false); } };
  return <section><h4>Vincular resposta e evidência declaradas</h4><p>Fonte: retorno da mesma OS, associação humana já registrada e snapshot da proposta aceita. A evidência não é autenticada e não comprova execução; não cria faturável ou cobrança. Carregue as páginas adicionais para consultar mais associações.</p>
    {opcoes.isError && <p role="alert">Opções indisponíveis ou sem permissão. <button type="button" onClick={() => void opcoes.refetch()}>Reconsultar</button></p>}
    {!opcoes.isFetching && !opcoes.isError && !consistentes && <p role="alert">Opções divergentes entre páginas. <button type="button" onClick={() => void opcoes.refetch()}>Reconsultar</button></p>}
    <form onSubmit={(e) => { e.preventDefault(); const x = selecionado; if (!x || !motivo.trim() || !fotografia || confirmacao !== fotografia || pendente || ocupado.current || !visiveis) return; const p = pedido.parse({ requestId: crypto.randomUUID(), cliente, declaracao, snapshot: x.snapshot_id, evidencia: x.vinculo_evidencia_id, motivo: motivo.trim() }); try { if (sessionStorage.getItem(chave)) return; sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setAviso("Não foi possível guardar a tentativa; nada enviado."); return; } setPendente(p); void enviar(p); }}>
      <fieldset disabled={!!pendente || !visiveis || enviando}><label>Resposta e evidência <select required value={escolha} onChange={(e) => { setEscolha(e.target.value); setConfirmacao(null); }}><option value="">Selecione</option>{visiveis && itens.map((v) => <option key={v.vinculo_evidencia_id} value={v.vinculo_evidencia_id}>Resposta {v.resposta_id} · evidência {v.evidencia_id} · retorno {v.retorno_id}</option>)}</select></label><label>Motivo <textarea required maxLength={1000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label><label><input type="checkbox" checked={!!fotografia && confirmacao === fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} disabled={!fotografia} /> Revisei a associação declarada.</label><button type="submit" disabled={!fotografia || confirmacao !== fotografia}>Registrar vínculo</button></fieldset>
    </form>{opcoes.hasNextPage && <button type="button" disabled={opcoes.isFetching} onClick={() => void opcoes.fetchNextPage()}>Mais associações</button>}{visiveis && itens.length === 0 && !opcoes.hasNextPage && <p>Sem opções disponíveis: é necessário snapshot e associação de evidência para esta OS.</p>}{pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={enviando} onClick={() => void enviar(pendente)}>Repetir mesma tentativa</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
