import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { VisitaResumo } from "../../application/visitas-gateway";
import { supabaseVisitasAdapter } from "../../infrastructure/supabase-visitas-adapter";

const pedidoSchema = z.object({
  requestId: z.string().uuid(), intencaoId: z.string().uuid(), novoVinculoId: z.string().uuid(),
  clienteId: z.string().min(1), origemId: z.string().min(1), destinoId: z.string().min(1), vinculoId: z.string().min(1),
  revisaoOrigem: z.number().int().safe().positive(), revisaoDestino: z.number().int().safe().positive(),
  sequencia: z.number().int().safe().positive(), motivo: z.string().trim().min(1).max(2000),
  tarefaEsperada: z.string().regex(/^[1-9][0-9]{0,18}$/),
  material: z.object({listaId:z.string().uuid(),eventoRevisao:z.number().int().safe().min(2)}).strict().optional(),
}).strict().refine((p) => p.origemId !== p.destinoId);
const excecaoSchema=z.object({lista_id:z.string().uuid(),revisao:z.number().int().min(2),motivo:z.string(),descricao:z.string(),revisao_linhas:z.number().int().nullable(),posicao:z.number().int().nullable(),ator_id:z.string().uuid(),criado_em:z.string().datetime({offset:true})}).strict();
type Pedido = z.infer<typeof pedidoSchema>;

/** Operação local; reconciliação da tarefa externa permanece pendente. */
type Props = { userId: string; clienteId: string; visitas: VisitaResumo[]; bloqueado: boolean };
export function TransferirOsEnviada(props: Props) {
  return <TransferirOsEnviadaInterna key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function TransferirOsEnviadaInterna({ userId, clienteId, visitas, bloqueado }: Props) {
  const chave = `sso-transferencia-os-enviada:${JSON.stringify([userId, clienteId])}`;
  const cache = useQueryClient();
  const trava = useRef(false);
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [vinculoId, setVinculoId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [sequencia, setSequencia] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.clienteId === clienteId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const origem = visitas.find((v) => v.id === origemId && ["confirmada", "enviada", "em_execucao", "parcial"].includes(v.estado));
  const destino = visitas.find((v) => v.id === destinoId && v.id !== origemId && ["rascunho", "planejada", "confirmada"].includes(v.estado));
  const ordens = useInfiniteQuery({
    queryKey: ["visitas", userId, clienteId, "transferencia-enviada", origemId],
    enabled: !!origem && !bloqueado && !pedido, gcTime: 0,
    initialPageParam: null as { sequencia: number; id: string } | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();
      if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const resultado=await supabaseVisitasAdapter.listarOs({ clienteId, visitaId: origemId, incluirHistorico: false, limite: 20, apos: pageParam }, signal);
      const depois=await supabase.auth.getUser();
      if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return resultado;
    },
    getNextPageParam: (pagina) => pagina.length === 20 && pagina.at(-1) ? { sequencia: pagina.at(-1)!.sequencia, id: pagina.at(-1)!.id } : undefined,
  });
  const identidade = useQuery({
    queryKey: ["visitas", userId, clienteId, "identidade-transferencia", origemId, vinculoId],
    enabled: !!origem && !!vinculoId && !bloqueado && !pedido, gcTime: 0, staleTime: 0,
    queryFn: async ({ signal }) => {
      const antes=await supabase.auth.getUser();
      if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_identidade_transferencia", {
        p_cliente_id: clienteId, p_origem_id: origemId, p_vinculo_id: vinculoId,
      }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ clienteId: z.string(), origemId: z.string(), vinculoId: z.string(), osId: z.string().min(1), tarefaAuvoId: z.string().regex(/^[1-9][0-9]{0,18}$/) }).strict().parse(data);
      if (r.clienteId !== clienteId || r.origemId !== origemId || r.vinculoId !== vinculoId) throw new Error("Identidade divergente.");
      const depois=await supabase.auth.getUser();
      if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return r;
    },
  });
  const excecoes=useInfiniteQuery({queryKey:["visitas",userId,clienteId,"excecoes-transferencia",identidade.data?.osId],enabled:import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&!!identidade.data&&!identidade.isFetching&&!identidade.isError&&!bloqueado&&!pedido,gcTime:0,
    initialPageParam:null as {lista:string;revisao:number}|null,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted||!identidade.data)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_listar_excecoes_para_intencao",{p_cliente_id:clienteId,p_os_id:identidade.data.osId,p_apos_lista:pageParam?.lista??null,p_apos_revisao:pageParam?.revisao??null,p_limite:20}).abortSignal(signal);if(error)throw error;
      const pagina=z.array(excecaoSchema).max(20).parse(data);let anterior=pageParam;for(const item of pagina){const lista=item.lista_id.toLowerCase();if(anterior&&(lista<anterior.lista.toLowerCase()||(lista===anterior.lista.toLowerCase()&&item.revisao<=anterior.revisao)))throw new Error("Página divergente.");anterior={lista,revisao:item.revisao};}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(pagina)=>{const ultima=pagina.at(-1);return pagina.length===20&&ultima?{lista:ultima.lista_id,revisao:ultima.revisao}:undefined;}});
  const material=excecoes.data?.pages.flat().find((e)=>JSON.stringify([e.lista_id,e.revisao])===materialId);
  const impedimento = useQuery({
    queryKey: ["visitas", userId, clienteId, "impedimento-transferencia", identidade.data?.osId],
    enabled: import.meta.env.VITE_SSO_IMPEDIMENTO_MATERIAL_OS_ENABLED === "true" && !!identidade.data && !identidade.isFetching && !identidade.isError && !bloqueado && !pedido,
    gcTime: 0, staleTime: 0,
    queryFn: async ({ signal }) => {
      const osId = identidade.data?.osId;
      const antes = await supabase.auth.getUser();
      if (!osId || antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_impedimentos_material_os", {
        p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId, p_antes: null, p_limite: 1,
      }).abortSignal(signal);
      if (error) throw error;
      const eventos = z.array(z.object({ revisao: z.number().int().positive(), lista_id: z.string().uuid(),
        evento_revision: z.number().int().min(2), estado: z.enum(["suspenso", "retomado"]), motivo: z.string(),
        ator_id: z.string().uuid(), criado_em: z.string().datetime({ offset: true }) }).strict()).max(1).parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return eventos[0] ?? null;
    },
  });
  const ordemSelecionada=ordens.data?.pages.flat().find(o=>o.id===vinculoId);
  const fotografia=JSON.stringify({userId,clienteId,origem:origem??null,destino:destino??null,ordem:ordemSelecionada??null,identidade:identidade.data??null,material:material??null,
    impedimento: import.meta.env.VITE_SSO_IMPEDIMENTO_MATERIAL_OS_ENABLED === "true" ? { consultando: impedimento.isFetching, erro: impedimento.isError, ultimo: impedimento.data ?? null } : null,
    sequencia,motivo});
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");
      const parametros={
        p_request_id: p.requestId, p_intencao_id: p.intencaoId, p_origem_id: p.origemId, p_destino_id: p.destinoId,
        p_vinculo_id: p.vinculoId, p_novo_vinculo_id: p.novoVinculoId, p_revisao_origem: p.revisaoOrigem,
        p_revisao_destino: p.revisaoDestino, p_sequencia: p.sequencia, p_motivo: p.motivo, p_tarefa_esperada: p.tarefaEsperada,
      };
      const {data,error}=p.material?await supabase.schema("pcm").rpc("sso_transferir_os_por_material",{...parametros,p_lista_id:p.material.listaId,p_evento_revisao:p.material.eventoRevisao}):await supabase.schema("pcm").rpc("sso_transferir_os_enviada_conferida",parametros);
      if (error) throw error;
      if (!data || data.requestId !== p.requestId || data.intencaoId !== p.intencaoId || data.origemId !== p.origemId ||
        data.destinoId !== p.destinoId || data.novoVinculoId !== p.novoVinculoId || data.tarefaAuvoId !== p.tarefaEsperada || data.efeitoRemoto !== false || data.estadoIntencao !== "pendente" ||
        (p.material&&(data.listaId!==p.material.listaId||data.eventoRevisao!==p.material.eventoRevisao))) throw new Error("Resposta divergente.");
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");
    },
    onSuccess: async (_resultado, p) => {
      await cache.invalidateQueries({ queryKey: ["visitas", userId, clienteId] });
      try {
        const atual=await supabase.auth.getUser();
        if (atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(chave) !== JSON.stringify(p)) { setMensagem("Transferência local registrada, mas há outra tentativa ou sessão. Reabra para conferi-la."); return; }
        sessionStorage.removeItem(chave);
      } catch { setMensagem("Transferência local registrada, mas tentativa não foi removida. Procure suporte."); return; }
      setPedido(null);
      setConfirmacao(null);
      setMensagem("Transferência local registrada; intenção pendente. A tarefa Auvo não foi alterada.");
    },
    onError: () => setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."),
    onSettled: () => { trava.current = false; },
  });
  const enviar = (p: Pedido) => {
    if (trava.current || bloqueado) return;
    try { if (sessionStorage.getItem(chave) !== JSON.stringify(p)) { setMensagem("Tentativa local alterada. Reabra para conferi-la."); return; } }
    catch { setMensagem("Não foi possível conferir tentativa; nada foi enviado."); return; }
    trava.current = true;
    envio.mutate(p);
  };
  return <section aria-label="Transferência local de OS enviada">
    <h4>Transferir OS enviada</h4>
    <p>A OS muda de Visita no SSO; a tarefa Auvo permanece igual e a intenção fica pendente de reconciliação. Visitas confirmadas exigem nova confirmação.</p>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (pedido || trava.current || bloqueado || confirmacao!==fotografia || !origem || !destino || ordens.isFetching || ordens.isError || identidade.isFetching || identidade.isError || !identidade.data || !ordens.data?.pages.flat().some((o) => o.id === vinculoId && o.osId === identidade.data.osId) ||
        (materialId&&(import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED!=="true"||!material||excecoes.isFetching||excecoes.isError))) return;
      try {
        const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), intencaoId: crypto.randomUUID(), novoVinculoId: crypto.randomUUID(), clienteId,
          origemId: origem.id, destinoId: destino.id, vinculoId, revisaoOrigem: origem.revisao, revisaoDestino: destino.revisao, sequencia: Number(sequencia), motivo, tarefaEsperada: identidade.data.tarefaAuvoId,...(material?{material:{listaId:material.lista_id,eventoRevisao:material.revisao}}:{}) });
        if (sessionStorage.getItem(chave) !== null) { setMensagem("Há tentativa anterior; reabra para recuperar."); return; }
        sessionStorage.setItem(chave, JSON.stringify(p)); setPedido(p); enviar(p);
      } catch { setMensagem("Confira dados e armazenamento; nada foi enviado."); }
    }}><fieldset disabled={!!pedido || bloqueado || envio.isPending}>
      <label>Origem da transferência <select required value={origemId} onChange={(e) => { setOrigemId(e.target.value); setVinculoId("");setMaterialId(""); }}><option value="">Selecione</option>
        {visitas.filter((v) => ["confirmada", "enviada", "em_execucao", "parcial"].includes(v.estado)).map((v) => <option key={v.id} value={v.id}>{v.inicioEm} · {v.estado}</option>)}</select></label>
      <label>Destino da transferência <select required value={destinoId} onChange={(e) => setDestinoId(e.target.value)}><option value="">Selecione</option>
        {visitas.filter((v) => v.id !== origemId && ["rascunho", "planejada", "confirmada"].includes(v.estado)).map((v) => <option key={v.id} value={v.id}>{v.inicioEm} · {v.estado}</option>)}</select></label>
      {ordens.isFetching && origem && <output>Carregando OS para transferência…</output>}
      {ordens.isError && <p role="alert">OS indisponíveis. <button type="button" onClick={() => void ordens.refetch()}>Tentar novamente</button></p>}
      <label>OS para transferir <select required disabled={!origem || ordens.isFetching || ordens.isError} value={vinculoId} onChange={(e) => {setVinculoId(e.target.value);setMaterialId("");}}><option value="">Selecione</option>
        {ordens.data?.pages.flat().map((o) => <option key={o.id} value={o.id}>{o.numero} · {o.titulo}</option>)}</select></label>
      {vinculoId && identidade.isFetching && <output>Conferindo identidade no SSO…</output>}
      {vinculoId && identidade.isError && <p role="alert">Identidade indisponível. <button type="button" onClick={() => void identidade.refetch()}>Tentar novamente</button></p>}
      {vinculoId && !identidade.isFetching && !identidade.isError && identidade.data && <p>Tarefa no SSO: {identidade.data.tarefaAuvoId}. A consulta não comprova estado no Auvo.</p>}
      {import.meta.env.VITE_SSO_IMPEDIMENTO_MATERIAL_OS_ENABLED === "true" && identidade.data && !identidade.isFetching && !identidade.isError && <>
        {impedimento.isFetching && <p>Consultando impedimento declarado…</p>}
        {impedimento.isError && <p role="alert">Não foi possível consultar o impedimento declarado da OS.</p>}
        {!impedimento.isFetching && !impedimento.isError && impedimento.data && <p>Último impedimento declarado: {impedimento.data.estado === "suspenso" ? "suspensão" : "retomada"}, revisão {impedimento.data.revisao}. Essa declaração não comprova alteração da tarefa no Auvo.</p>}
        {!impedimento.isFetching && !impedimento.isError && impedimento.data === null && <p>Nenhum impedimento local declarado foi encontrado; isso não comprova disponibilidade de materiais.</p>}
      </>}
      {ordens.hasNextPage && <button type="button" onClick={() => void ordens.fetchNextPage()}>Mais OS para transferência</button>}
      {import.meta.env.VITE_SSO_INTENCAO_MATERIAL_ENABLED==="true"&&identidade.data&&!identidade.isFetching&&!identidade.isError&&<>
        <p>Associar exceção histórica não confirma que ela continua aberta.</p>
        {excecoes.isFetching&&<output>Carregando exceções…</output>}
        {excecoes.isError&&<p role="alert">Exceções indisponíveis. <button type="button" onClick={()=>void excecoes.refetch()}>Tentar novamente</button></p>}
        <label>Exceção de material (opcional) <select value={materialId} disabled={excecoes.isFetching||excecoes.isError} onChange={(e)=>setMaterialId(e.target.value)}><option value="">Sem associação</option>
          {excecoes.data?.pages.flat().map((e)=><option key={`${e.lista_id}:${e.revisao}`} value={JSON.stringify([e.lista_id,e.revisao])}>{e.motivo} · {e.descricao} · revisão {e.revisao}</option>)}</select></label>
        {excecoes.hasNextPage&&<button type="button" disabled={excecoes.isFetching} onClick={()=>void excecoes.fetchNextPage()}>Mais exceções</button>}
      </>}
      <label>Sequência no destino <input type="number" required min="1" step="1" value={sequencia} onChange={(e) => setSequencia(e.target.value)} /></label>
      <label>Motivo da transferência <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      {confirmacao && confirmacao!==fotografia && <p role="alert">Dados ou revisões mudaram; confira novamente a transferência.</p>}
      <label><input type="checkbox" checked={confirmacao===fotografia} disabled={!origem||!destino||!ordemSelecionada||!identidade.data||ordens.isFetching||identidade.isFetching||ordens.isError||identidade.isError||(import.meta.env.VITE_SSO_IMPEDIMENTO_MATERIAL_OS_ENABLED === "true" && impedimento.isFetching)} onChange={(e)=>setConfirmacao(e.target.checked?fotografia:null)}/> Conferi a mesma OS, tarefa, origem, destino e eventual exceção; a tarefa Auvo não será alterada por esta ação.</label>
      <button type="submit" disabled={confirmacao!==fotografia}>Transferir e registrar intenção</button>
    </fieldset></form>
    {pedido === "invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    {pedido && pedido !== "invalido" && <button type="button" disabled={bloqueado || envio.isPending} onClick={() => enviar(pedido)}>Repetir transferência enviada</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
