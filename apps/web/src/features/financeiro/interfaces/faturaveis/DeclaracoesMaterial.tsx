import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { VincularMaterialProposta } from "./VincularMaterialProposta";
import { VincularLinhaMaterial } from "./VincularLinhaMaterial";
import { ReconhecerLinhaMaterial } from "./ReconhecerLinhaMaterial";

const linha = z.object({ id: z.string().uuid(), os_id: z.string().uuid(), lista_id: z.string().uuid(), lista_revisao: z.number().int().positive(),
  descricao: z.string(), evidencia: z.string(), estado: z.enum(["pendente", "aceita", "rejeitada"]), revisao: z.number().int().positive(), criado_em: z.string() }).strict();
const pedido = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("declarar"), requestId: z.string().uuid(), id: z.string().uuid(), listaId: z.string().uuid(), revisao: z.number().int().positive(), descricao: z.string().min(1).max(1000), evidencia: z.string().min(1).max(1000) }).strict(),
  z.object({ tipo: z.literal("revisar"), requestId: z.string().uuid(), id: z.string().uuid(), revisao: z.number().int().positive(), decisao: z.enum(["aceita", "rejeitada"]), motivo: z.string().min(1).max(1000) }).strict(),
]);
type Pedido = z.infer<typeof pedido>;
export function DeclaracoesMaterial(props: { usuario: string; cliente: string }) {
  if (import.meta.env.VITE_SSO_DECLARACAO_MATERIAL_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente])} {...props} />;
}
function Conteudo({ usuario, cliente }: { usuario: string; cliente: string }) {
  const chave = `sso-declaracao-material:${JSON.stringify([usuario, cliente])}`; const query = ["declaracoes-material", usuario, cliente];
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const s = sessionStorage.getItem(chave); return s ? pedido.parse(JSON.parse(s)) : null; } catch { return "invalido"; } });
  const [listaId, setListaId] = useState(""); const [revisao, setRevisao] = useState(""); const [descricao, setDescricao] = useState(""); const [evidencia, setEvidencia] = useState("");
  const [motivos, setMotivos] = useState<Record<string, string>>({}); const [aviso, setAviso] = useState(""); const enviando = useRef(false); const cache = useQueryClient();
  const lista = useInfiniteQuery({ queryKey: query, gcTime: 0, staleTime: 0, retry: false, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_listar_declaracoes_material", { p_cliente_id: cliente, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(linha).max(20).parse(data); }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const comando = useMutation({ mutationFn: async (p: Pedido) => {
    const resultado = p.tipo === "declarar" ? await supabase.schema("financeiro").rpc("sso_declarar_material_fornecido", { p_request_id: p.requestId, p_declaracao_id: p.id,
      p_cliente_id: cliente, p_lista_id: p.listaId, p_lista_revisao: p.revisao, p_descricao: p.descricao, p_evidencia: p.evidencia }) :
      await supabase.schema("financeiro").rpc("sso_revisar_material_fornecido", { p_request_id: p.requestId, p_declaracao_id: p.id, p_revisao: p.revisao, p_decisao: p.decisao, p_motivo: p.motivo });
    if (resultado.error) throw resultado.error; if (z.string().uuid().parse(resultado.data) !== p.id) throw new Error("Resposta divergente");
  }, onSuccess: async (_r, p) => {
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Pedido divergente"); sessionStorage.removeItem(chave); }
    catch { setAviso("Pedido processado, mas tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setAviso("Declaração atualizada; nenhuma cobrança foi criada."); await cache.invalidateQueries({ queryKey: query });
  }, onError: () => setAviso("Resultado não confirmado. Repita o pedido ou consulte suporte."), onSettled: () => { enviando.current = false; } });
  function enviar(p: Pedido) { if (enviando.current) return; enviando.current = true; setAviso(""); comando.mutate(p); }
  function iniciar(p: unknown) { if (pendente || enviando.current) return; try { const valido = pedido.parse(p);
    if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido existente"); sessionStorage.setItem(chave, JSON.stringify(valido)); setPendente(valido); enviar(valido);
  } catch { setAviso("Confira os dados e a sessão. Nada foi enviado."); } }
  return <section><h3>Declarações de material fornecido</h3><p>Declaração humana revisável, não comprova consumo e não cria item faturável nem cobrança.</p>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={comando.isPending} onClick={() => enviar(pendente)}>Repetir pedido</button> :
      !pendente && <form onSubmit={(e) => { e.preventDefault(); iniciar({ tipo: "declarar", requestId: crypto.randomUUID(), id: crypto.randomUUID(), listaId: listaId.trim(), revisao: /^\d+$/.test(revisao) ? Number(revisao) : NaN, descricao: descricao.trim(), evidencia: evidencia.trim() }); }}>
        <label>Identificador da lista <input required value={listaId} onChange={(e) => setListaId(e.target.value)} /></label>
        <label>Revisão da lista <input required inputMode="numeric" value={revisao} onChange={(e) => setRevisao(e.target.value)} /></label>
        <label>Material declarado <textarea required maxLength={1000} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
        <label>Referência da evidência <textarea required maxLength={1000} value={evidencia} onChange={(e) => setEvidencia(e.target.value)} /></label>
        <button type="submit" disabled={comando.isPending}>Registrar declaração</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
    {lista.isFetching && <p>Consultando declarações…</p>}
    {lista.isError && <p role="alert">Não foi possível consultar declarações. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isError && lista.data?.pages.flat().map((d) => <article key={d.id}><p>{d.descricao} · OS {d.os_id} · lista {d.lista_id} revisão {d.lista_revisao} · {d.estado}</p><p>Evidência declarada: {d.evidencia}</p>
      {d.estado === "aceita" && import.meta.env.VITE_SSO_MATERIAL_PROPOSTA_ENABLED === "true" && <VincularMaterialProposta usuario={usuario} cliente={cliente} declaracaoId={d.id} />}
      {d.estado === "aceita" && import.meta.env.VITE_SSO_MATERIAL_LINHA_ENABLED === "true" && <VincularLinhaMaterial usuario={usuario} cliente={cliente} declaracaoId={d.id} />}
      {d.estado === "aceita" && import.meta.env.VITE_SSO_CANDIDATO_LINHA_ENABLED === "true" && <ReconhecerLinhaMaterial usuario={usuario} cliente={cliente} declaracaoId={d.id} />}
      {d.estado === "pendente" && <div><label>Motivo da revisão <input value={motivos[d.id] ?? ""} maxLength={1000} onChange={(e) => setMotivos((v) => ({ ...v, [d.id]: e.target.value }))} /></label>
        {(["aceita", "rejeitada"] as const).map((decisao) => <button key={decisao} type="button" disabled={!!pendente || comando.isPending || !(motivos[d.id] ?? "").trim()}
          onClick={() => iniciar({ tipo: "revisar", requestId: crypto.randomUUID(), id: d.id, revisao: d.revisao, decisao, motivo: motivos[d.id]!.trim() })}>{decisao === "aceita" ? "Aceitar declaração" : "Rejeitar declaração"}</button>)}</div>}
    </article>)}
    {!lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais declarações</button>}
  </section>;
}
