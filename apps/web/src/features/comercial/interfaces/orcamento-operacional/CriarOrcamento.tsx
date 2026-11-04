import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z.object({ requestId: z.string().uuid(), oportunidadeId: z.string().uuid().nullable(),
  listaId: z.string().uuid(), listaRevision: z.number().int().positive(), ordemServicoId: z.string().uuid() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { usuario: string; cliente: string; ordemServico: string; listaInicialId?: string };
export function CriarOrcamento(props: Props) {
  if (import.meta.env.VITE_SSO_CRIAR_ORCAMENTO_OPERACIONAL_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.ordemServico])} {...props} />;
}
function Conteudo({ usuario, cliente, ordemServico, listaInicialId }: Props) {
  const chave = `sso-criar-orcamento:${usuario}:${cliente}:${ordemServico}`;
  const queryClient = useQueryClient();
  const enviando = useRef(false);
  const [oportunidadeId, setOportunidadeId] = useState("");
  const [listaId, setListaId] = useState(listaInicialId ?? "");
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo)); return p.ordemServicoId === ordemServico ? p : "invalido";
    } catch { return "invalido"; }
  });
  const oportunidades = useInfiniteQuery({ queryKey: ["orcamento-criacao", usuario, cliente, ordemServico, "oportunidades"], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("comercial").rpc("sso_listar_oportunidades_orcamento", { p_cliente_id: cliente, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error;
      const pagina=z.array(z.object({ id: z.string().uuid(), titulo: z.string() }).strict()).max(20).parse(data);
      let anterior=pageParam?.toLowerCase() ?? null;
      for(const item of pagina){const id=item.id.toLowerCase();if(anterior!==null && id<=anterior)throw new Error("Página inválida.");anterior=id;}
      return pagina; }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.id : undefined });
  const listas = useInfiniteQuery({ queryKey: ["orcamento-criacao", usuario, cliente, ordemServico, "listas"], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_listar_listas_materiais_mediada", {
      p_cliente_id: cliente, p_ordem_servico_id: ordemServico, p_limite: 100, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(z.object({ id: z.string().uuid(), ordem_servico_id: z.string().uuid(),
        responsavel: z.enum(["cliente", "sinergica"]), revisao: z.number().int().positive(), texto_original: z.string() }).passthrough()).max(100).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        const id = item.id.toLowerCase();
        if (item.ordem_servico_id.toLowerCase() !== ordemServico.toLowerCase() || (anterior && id <= anterior)) throw new Error("Página inválida.");
        anterior = id;
      }
      return pagina; }, getNextPageParam: (p) => p.length === 100 ? p.at(-1)?.id : undefined });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    const { data, error } = p.oportunidadeId
      ? await supabase.schema("comercial").rpc("sso_criar_orcamento_operacional", {
        p_request_id: p.requestId, p_oportunidade_id: p.oportunidadeId, p_lista_id: p.listaId, p_lista_revision: p.listaRevision })
      : await supabase.schema("comercial").rpc("sso_criar_orcamento_sem_oportunidade", {
        p_request_id: p.requestId, p_lista_id: p.listaId, p_lista_revision: p.listaRevision });
    if (error) throw error;
    if (!data || data.requestId !== p.requestId || data.revision !== 1 || data.state !== "rascunho" ||
      typeof data.aggregateId !== "string" || data.linkedIds?.listaId !== p.listaId || data.linkedIds?.ordemServicoId !== p.ordemServicoId)
      throw new Error("Resposta inválida.");
  }, onSuccess: async (_resultado, p) => { try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) { setMensagem("Rascunho criado, mas a tentativa local divergiu; procure suporte."); return; } sessionStorage.removeItem(chave); } catch { setMensagem("Rascunho criado; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setMensagem("Rascunho criado; complete e revise a composição.");
    await queryClient.invalidateQueries({ queryKey: ["orcamentos-operacionais", usuario, cliente, ordemServico] }); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa; não crie outra proposta."), onSettled: () => { enviando.current = false; }, });
  function registrar(p: Pedido) {
    if (enviando.current) return;
    try {
      const existente = sessionStorage.getItem(chave);
      const serializado = JSON.stringify(p);
      if (existente !== null && existente !== serializado) { setMensagem("Existe outra tentativa pendente. Não crie uma nova proposta; procure suporte."); return; }
      if (existente === null && pendente !== null) { setMensagem("Tentativa pendente não encontrada. Procure suporte antes de repetir."); return; }
      if (existente === null) sessionStorage.setItem(chave, serializado);
    } catch { setMensagem("Não foi possível guardar tentativa; rascunho não enviado."); return; }
    enviando.current = true; setPendente(p); setMensagem(""); enviar.mutate(p);
  }
  const listasElegiveis = listas.isError ? [] : listas.data?.pages.flat().filter((l) => l.responsavel === "sinergica" && l.ordem_servico_id.toLowerCase() === ordemServico.toLowerCase()) ?? [];
  const lista = listasElegiveis.find((l) => l.id === listaId);
  return <form onSubmit={(e) => { e.preventDefault(); if (pendente || enviar.isPending || enviando.current || !lista || listas.isFetching || listas.isError || oportunidades.isFetching || oportunidades.isError) return;
    const semOportunidade = oportunidadeId === "sem-oportunidade" && import.meta.env.VITE_SSO_ORCAMENTO_SEM_OPORTUNIDADE_ENABLED === "true";
    if (!semOportunidade && !oportunidades.data?.pages.flat().some((opcao) => opcao.id === oportunidadeId)) { setMensagem("A oportunidade selecionada não está mais disponível. Atualize a consulta."); return; }
    try { registrar(pedidoSchema.parse({ requestId: crypto.randomUUID(), oportunidadeId: oportunidadeId === "sem-oportunidade" ? null : oportunidadeId, listaId,
      listaRevision: lista.revisao, ordemServicoId: ordemServico })); }
    catch { setMensagem("Selecione oportunidade e lista compatíveis."); }
  }}>
    <h4>Criar orçamento operacional</h4>
    <p>Selecione a origem e uma lista desta OS. O rascunho não envia proposta nem gera cobrança.</p>
    {listaInicialId && !lista && !listas.isFetching && !listas.isError && <p role="status">A lista indicada ainda não está nas páginas carregadas ou não está disponível para a Sinérgica. Confira as listas antes de criar o rascunho.</p>}
    {(oportunidades.isError || listas.isError) && <p role="alert">Não foi possível consultar oportunidades ou listas autorizadas.</p>}
    {oportunidades.data?.pages.flat().length === 0 && !oportunidades.hasNextPage && <p>Não há oportunidade aberta disponível; não será criada oportunidade automática.</p>}
    <fieldset disabled={!!pendente || enviar.isPending || oportunidades.isFetching || listas.isFetching || oportunidades.isError || listas.isError}>
      <label>Oportunidade <select required value={oportunidadeId} onChange={(e) => setOportunidadeId(e.target.value)}>
        <option value="">Selecione</option>
        {import.meta.env.VITE_SSO_ORCAMENTO_SEM_OPORTUNIDADE_ENABLED === "true" && <option value="sem-oportunidade">Origem operacional, sem oportunidade</option>}
        {oportunidades.data?.pages.flat().map((o) => <option key={o.id} value={o.id}>{o.titulo} · {o.id}</option>)}</select></label>
      <label>Lista de materiais <select required value={listaId} onChange={(e) => setListaId(e.target.value)}>
        <option value="">Selecione</option>{listasElegiveis.map((l) => <option key={l.id} value={l.id}>{l.texto_original.trim().replace(/\s+/g, " ").slice(0, 100) || "Lista sem descrição"} · revisão {l.revisao} · {l.id}</option>)}</select></label>
      {lista && !listas.isFetching && !listas.isError && <div><p>Texto original da lista selecionada (revisão {lista.revisao}):</p><pre>{lista.texto_original}</pre></div>}
      <button type="submit">Criar rascunho</button>
    </fieldset>
    {oportunidades.hasNextPage && <button type="button" disabled={oportunidades.isFetching} onClick={() => void oportunidades.fetchNextPage()}>Mais oportunidades</button>}
    {listas.hasNextPage && <button type="button" disabled={listas.isFetching} onClick={() => void listas.fetchNextPage()}>Mais listas da OS</button>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
