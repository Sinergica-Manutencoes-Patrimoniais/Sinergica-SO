import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { VisibilidadeOrcamento } from "./VisibilidadeOrcamento";

const pedidoSchema = z.object({ requestId: z.string().uuid(), propostaId: z.string().uuid(), versao: z.number().int().positive(),
  estadoEsperado: z.enum(["rascunho", "em_revisao", "aprovada"]), acao: z.enum(["revisar", "aprovar", "publicar"]),
  escopoPublico: z.string().max(4000).nullable(), descricaoPublica: z.string().max(1000).nullable(),
  itensPublicos: z.array(z.object({ id: z.string().uuid(), descricao: z.string().min(1).max(1000), quantidade: z.number().int().positive().max(999999), precoUnitarioCentavos: z.number().int().min(0).max(1000000000000) }).strict()).min(1).max(100).optional() }).strict()
  .refine((p) => p.acao === "publicar" ? !!p.escopoPublico?.trim() && !!p.descricaoPublica?.trim()
    : p.escopoPublico === null && p.descricaoPublica === null);
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { usuario: string; cliente: string; ordemServico: string; propostaId: string; versao: number; status: string };
export function TransicionarOperacional(props: Props) {
  if (import.meta.env.VITE_SSO_PUBLICAR_ORCAMENTO_OPERACIONAL_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.ordemServico, props.propostaId])} {...props} />;
}
function Conteudo({ usuario, cliente, ordemServico, propostaId, versao, status }: Props) {
  const chave = `sso-transicao-orcamento:${usuario}:${cliente}:${ordemServico}:${propostaId}`;
  const enviando = useRef(false);
  const queryClient = useQueryClient();
  const [escopo, setEscopo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itens, setItens] = useState([{ descricao: "", quantidade: "", preco: "" }]);
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo)); return p.propostaId === propostaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  async function conferirSessao(signal?: AbortSignal) { const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada."); }
  const origem = useQuery({ queryKey: ["orcamento-origem", usuario, cliente, ordemServico, propostaId], gcTime: 0,
    retry: false, queryFn: async ({ signal }) => { await conferirSessao(signal); const { data, error } = await supabase.schema("comercial").rpc("sso_orcamento_operacional_autorizado", { p_proposta_id: propostaId }).abortSignal(signal);
      if (error) throw error; const resposta = z.boolean().parse(data); await conferirSessao(signal); return resposta; } });
  const preco = useQuery({ queryKey: ["orcamento-preco-publicacao", usuario, cliente, ordemServico, propostaId, versao, status],
    gcTime: 0, retry: false, enabled: origem.data === true && !origem.isFetching && !origem.isError, queryFn: async ({ signal }) => {
      await conferirSessao(signal); const { data, error } = await supabase.schema("comercial").rpc("sso_preco_orcamento_operacional", { p_proposta_id: propostaId }).abortSignal(signal);
      if (error) throw error;
      const resposta = z.array(z.object({ versao: z.number().int().positive(), status: z.string(),
        preco_centavos: z.number().int().nonnegative().safe(), valido_ate: z.string().nullable() }).strict()).length(1).parse(data)[0]; await conferirSessao(signal); return resposta;
    } });
  const diagnosticoAtivo = import.meta.env.VITE_SSO_DIAGNOSTICO_FONTE_RETIFICADA_ENABLED === "true";
  const diagnostico = useQuery({ queryKey: ["orcamento-fonte-retificada", usuario, cliente, propostaId, versao], gcTime: 0, retry: false,
    enabled: diagnosticoAtivo && origem.data === true && !origem.isFetching && !origem.isError,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("comercial").rpc("sso_diagnosticar_fonte_retificada", {
        p_ator_id: usuario, p_cliente_id: cliente, p_proposta_id: propostaId, p_versao: versao,
      }).abortSignal(signal); if (error) throw error;
      const r = z.object({ clienteId: z.string().uuid(), propostaId: z.string().uuid(), versao: z.number().int().positive(),
        estado: z.enum(["sem_fotografia", "fonte_retificada", "sem_retificacao_observada"]) }).strict().parse(data);
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== usuario || signal.aborted || r.clienteId !== cliente || r.propostaId !== propostaId || r.versao !== versao) throw new Error("Contexto divergente");
      return r;
    } });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou pedido alterado.");
    const resposta = p.acao === "publicar" && p.itensPublicos ? await supabase.schema("comercial").rpc("sso_publicar_orcamento_itens", {
      p_request_id: p.requestId, p_proposta_id: p.propostaId, p_versao: p.versao, p_escopo: p.escopoPublico, p_descricao: p.descricaoPublica, p_itens: p.itensPublicos,
    }) : await supabase.schema("comercial").rpc("sso_transicionar_orcamento_sem_oportunidade", {
      p_request_id: p.requestId, p_proposta_id: p.propostaId, p_versao: p.versao,
      p_estado_esperado: p.estadoEsperado, p_acao: p.acao, p_escopo_publico: p.escopoPublico, p_descricao_publica: p.descricaoPublica,
    });
    const { data, error } = resposta;
    if (error) throw error;
    const destino = p.acao === "revisar" ? "em_revisao" : p.acao === "aprovar" ? "aprovada" : "enviada";
    if (!data || data.requestId !== p.requestId || data.aggregateId !== propostaId || data.revision !== p.versao || data.state !== destino)
      throw new Error("Resposta inválida.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario)throw new Error("Sessão alterada.");
  }, onSuccess: async (_resultado, p) => { try { const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==usuario||sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente"); sessionStorage.removeItem(chave); } catch { setMensagem("Operação registrada; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setConfirmado(null); setMensagem("Estado atualizado. Publicação não envia mensagem externa.");
    await queryClient.invalidateQueries({ queryKey: ["orcamentos-operacionais", usuario, cliente, ordemServico] }); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."), onSettled: () => { enviando.current = false; } });
  function registrar(p: Pedido) { if (enviando.current) return; try { const guardado = sessionStorage.getItem(chave); const novo = JSON.stringify(p); if ((guardado !== null && guardado !== novo) || (guardado === null && pendente !== null)) throw new Error("Tentativa divergente"); if(guardado===null)sessionStorage.setItem(chave, novo); } catch { setMensagem("Não foi possível guardar tentativa; operação não enviada."); return; }
    enviando.current = true; setPendente(p); setMensagem(""); enviar.mutate(p); }
  const recuperar = <>{pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}{pendente && pendente !== "invalido" && <><p>Há uma tentativa pendente; repetir usa o mesmo pedido e depende da autorização atual no servidor.</p><button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button></>}{mensagem && <p role="status">{mensagem}</p>}</>;
  if (origem.isFetching || origem.isPending) return <section><p>Verificando acesso à proposta…</p>{recuperar}</section>;
  if (origem.isError) return <section><p role="alert">Não foi possível verificar origem da proposta. <button type="button" onClick={() => void origem.refetch()}>Tentar novamente</button></p>{recuperar}</section>;
  if (!origem.data) return <section>{recuperar}</section>;
  if (preco.isPending || preco.isFetching) return <section><p>Consultando dados da proposta…</p>{recuperar}</section>;
  if (preco.isError || !preco.data || preco.data.versao !== versao || preco.data.status !== status)
    return <section><p role="alert">Não foi possível confirmar dados atuais da proposta. Atualize a lista.</p>{recuperar}</section>;
  const acao = status === "rascunho" ? "revisar" : status === "em_revisao" ? "aprovar" : status === "aprovada" ? "publicar" : null;
  const fotografiaPublicacao=JSON.stringify({usuario,cliente,ordemServico,propostaId,versao,status,preco:preco.data,escopo,descricao,itens});
  return <section aria-label="Revisão do orçamento operacional">
    <p>Preço de venda: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preco.data.preco_centavos / 100)} · Validade: {preco.data.valido_ate ?? "não informada"}.</p>
    {diagnosticoAtivo && diagnostico.isFetching && <p role="status">Conferindo fontes da versão…</p>}
    {diagnosticoAtivo && diagnostico.isError && <p role="alert">Não foi possível conferir as fontes. <button type="button" onClick={() => void diagnostico.refetch()}>Tentar novamente</button></p>}
    {diagnosticoAtivo && !diagnostico.isFetching && !diagnostico.isError && diagnostico.data?.estado === "fonte_retificada" && <p role="alert">Fonte desta versão foi retificada. Refaça a composição antes da transição.</p>}
    {diagnosticoAtivo && !diagnostico.isFetching && !diagnostico.isError && diagnostico.data?.estado === "sem_fotografia" && <p>Esta versão não tem fotografia mista identificada; confira as fontes por outro caminho.</p>}
    {diagnosticoAtivo && !diagnostico.isFetching && !diagnostico.isError && diagnostico.data?.estado === "sem_retificacao_observada" && <p>Nenhuma retificação encontrada na fotografia mista. Isso não comprova ausência de duplicidades.</p>}
    {status === "enviada" && import.meta.env.VITE_SSO_VISIBILIDADE_ORCAMENTO_ENABLED === "true" && <VisibilidadeOrcamento usuario={usuario} cliente={cliente} propostaId={propostaId} versao={versao} />}
    {acao && <form onSubmit={(e) => { e.preventDefault(); if (pendente || enviar.isPending || enviando.current || (acao === "publicar" && confirmado!==fotografiaPublicacao)) return;
      try { const estruturado = acao === "publicar" && import.meta.env.VITE_SSO_PUBLICAR_ITENS_PROPOSTA_ENABLED === "true";
        const itensPublicos = estruturado ? itens.map((i) => {
          if (!/^\d+$/.test(i.quantidade) || !/^\d+$/.test(i.preco)) throw new Error("Valores inválidos");
          return { id: crypto.randomUUID(), descricao: i.descricao.trim(), quantidade: Number(i.quantidade), precoUnitarioCentavos: Number(i.preco) };
        }) : undefined;
        registrar(pedidoSchema.parse({ requestId: crypto.randomUUID(), propostaId, versao, estadoEsperado: status, acao,
        escopoPublico: acao === "publicar" ? escopo.trim() : null, descricaoPublica: acao === "publicar" ? descricao.trim() : null, itensPublicos })); }
      catch { setMensagem("Confira dados públicos e revisão."); }
    }}><fieldset disabled={!!pendente || enviar.isPending}>
      {acao === "publicar" && <><p>Revise o texto público. Não inclua custos, fornecedores internos ou comprovantes.</p>
        <label>Escopo público <textarea maxLength={4000} value={escopo} onChange={(e) => setEscopo(e.target.value)} /></label>
        <label>Descrição pública <input maxLength={1000} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
        {import.meta.env.VITE_SSO_PUBLICAR_ITENS_PROPOSTA_ENABLED === "true" && <div><p>Informe itens públicos; o total deve corresponder ao preço da proposta.</p>
          {itens.map((item, i) => <div key={i}>
            <label>Descrição <input required maxLength={1000} value={item.descricao} onChange={(e) => setItens((v) => v.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} /></label>
            <label>Quantidade inteira <input required inputMode="numeric" value={item.quantidade} onChange={(e) => setItens((v) => v.map((x, j) => j === i ? { ...x, quantidade: e.target.value } : x))} /></label>
            <label>Preço unitário em centavos <input required inputMode="numeric" value={item.preco} onChange={(e) => setItens((v) => v.map((x, j) => j === i ? { ...x, preco: e.target.value } : x))} /></label>
            {itens.length > 1 && <button type="button" onClick={() => setItens((v) => v.filter((_x, j) => j !== i))}>Remover item</button>}
          </div>)}
          <button type="button" disabled={itens.length >= 100} onClick={() => setItens((v) => [...v, { descricao: "", quantidade: "", preco: "" }])}>Adicionar item</button>
        </div>}
        {confirmado && confirmado!==fotografiaPublicacao && <p role="alert">Dados públicos ou preço mudaram; revise novamente.</p>}
        <label><input type="checkbox" checked={confirmado===fotografiaPublicacao} onChange={(e) => setConfirmado(e.target.checked?fotografiaPublicacao:null)} /> Revisei o texto para o Cliente.</label></>}
      <button type="submit" disabled={acao === "publicar" && confirmado!==fotografiaPublicacao}>{acao === "revisar" ? "Enviar para revisão" : acao === "aprovar" ? "Aprovar internamente" : "Publicar no Portal"}</button>
    </fieldset></form>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
