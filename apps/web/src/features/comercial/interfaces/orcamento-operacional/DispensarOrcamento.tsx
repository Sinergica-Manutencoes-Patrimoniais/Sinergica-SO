import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { HistoricoDispensa } from "./HistoricoDispensa";

const pedidoSchema = z.object({ requestId: z.string().uuid(), dispensaId: z.string().uuid(), listaId: z.string().uuid(),
  listaRevision: z.number().int().positive(), ordemServicoId: z.string().uuid(), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { usuario: string; cliente: string; ordemServico: string };
export function DispensarOrcamento(props: Props) {
  if (import.meta.env.VITE_SSO_DISPENSA_ORCAMENTO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.ordemServico])} {...props} />;
}
function Conteudo({ usuario, cliente, ordemServico }: Props) {
  const chave = `sso-dispensa-orcamento:${usuario}:${cliente}:${ordemServico}`; const queryClient = useQueryClient();
  const enviando = useRef(false);
  const [listaId, setListaId] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false); const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo)); return p.ordemServicoId === ordemServico ? p : "invalido";
    } catch { return "invalido"; }
  });
  const listas = useInfiniteQuery({ queryKey: ["dispensa-listas", usuario, cliente, ordemServico], gcTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_listas_materiais_mediada", {
        p_cliente_id: cliente, p_ordem_servico_id: ordemServico, p_limite: 20, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(z.object({ id: z.string().uuid(), ordem_servico_id: z.string().uuid(),
        revisao: z.number().int().positive(), responsavel: z.enum(["cliente", "sinergica"]) }).passthrough()).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        const id = item.id.toLowerCase();
        if (item.ordem_servico_id.toLowerCase() !== ordemServico.toLowerCase() || (anterior && id <= anterior)) throw new Error("Página inválida.");
        anterior = id;
      }
      return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const existente = useQuery({ queryKey: ["dispensa-lista", usuario, cliente, ordemServico, listaId], gcTime: 0, retry: false, enabled: !!listaId,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("comercial").rpc("sso_consultar_dispensa", { p_lista_id: listaId }).abortSignal(signal);
      if (error) throw error; return z.array(z.object({ id: z.string().uuid(), lista_revisao: z.number().int().positive(),
        motivo: z.string(), ator_id: z.string().uuid(), criado_em: z.string() }).strict()).max(1).parse(data)[0] ?? null; } });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa local divergente.");
    const { data, error } = await supabase.schema("comercial").rpc("sso_dispensar_orcamento", {
      p_request_id: p.requestId, p_dispensa_id: p.dispensaId, p_lista_id: p.listaId,
      p_lista_revision: p.listaRevision, p_motivo: p.motivo });
    if (error) throw error;
    if (!data || data.aggregateId !== p.dispensaId || data.revision !== p.listaRevision || data.state !== "dispensado" ||
      data.requestId !== p.requestId || data.linkedIds?.listaId !== p.listaId || data.linkedIds?.ordemServicoId !== p.ordemServicoId)
      throw new Error("Resposta inválida.");
  }, onSuccess: async (_resultado, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente"); sessionStorage.removeItem(chave); } catch { setMensagem("Dispensa registrada; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setMensagem("Dispensa registrada. Não altera valor, proposta ou faturamento.");
    await queryClient.invalidateQueries({ queryKey: ["dispensa-lista", usuario, cliente, ordemServico] }); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."), onSettled: () => { enviando.current = false; } });
  function registrar(p: Pedido) { if (enviando.current) return; try { const guardado = sessionStorage.getItem(chave); const novo = JSON.stringify(p); if (guardado !== null && guardado !== novo) throw new Error("Tentativa divergente"); sessionStorage.setItem(chave, novo); } catch { setMensagem("Não foi possível guardar tentativa; dispensa não enviada."); return; }
    enviando.current = true; setPendente(p); setMensagem(""); enviar.mutate(p); }
  const lista = !listas.isError ? listas.data?.pages.flat().find((l) => l.id === listaId && l.ordem_servico_id.toLowerCase() === ordemServico.toLowerCase()) : undefined;
  return <section><h4>Dispensa de orçamento</h4>
    <p>Dispensa somente o documento; não define valor zero nem elimina eventual faturamento.</p>
    {(listas.isError || existente.isError) && <p role="alert">Não foi possível consultar lista ou dispensa autorizada.</p>}
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || enviar.isPending || enviando.current || !confirmado || !lista || existente.data !== null) return;
      try { registrar(pedidoSchema.parse({ requestId: crypto.randomUUID(), dispensaId: crypto.randomUUID(),
        listaId: lista.id, listaRevision: lista.revisao, ordemServicoId: ordemServico, motivo })); }
      catch { setMensagem("Selecione lista e informe o motivo ou regra aplicável."); }
    }}><fieldset disabled={!!pendente || enviar.isPending || listas.isPending || listas.isError}>
      <label>Lista <select required value={listaId} onChange={(e) => { setListaId(e.target.value); setConfirmado(false); }}>
        <option value="">Selecione</option>{!listas.isError && listas.data?.pages.flat().map((l) => <option key={l.id} value={l.id}>{l.id} · revisão {l.revisao} · {l.responsavel}</option>)}</select></label>
      {listas.hasNextPage && <button type="button" onClick={() => void listas.fetchNextPage()}>Mais listas</button>}
      {listaId && existente.isFetching && <p>Consultando dispensa…</p>}
      {existente.data && <p>Dispensa já registrada na revisão {existente.data.lista_revisao}: {existente.data.motivo} · {new Date(existente.data.criado_em).toLocaleString("pt-BR")}</p>}
      <label>Motivo ou regra aplicável <textarea maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} /> Revisei o motivo e autorizo a dispensa do documento.</label>
      <button type="submit" disabled={!confirmado || !lista || existente.isFetching || existente.isError || existente.data !== null}>Registrar dispensa</button>
    </fieldset></form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
    {lista && !existente.isFetching && !existente.isError && existente.data !== undefined && <HistoricoDispensa
      usuario={usuario} cliente={cliente} ordemServico={ordemServico} listaId={lista.id} listaRevision={lista.revisao} vigenteId={existente.data?.id ?? null} />}
  </section>;
}
