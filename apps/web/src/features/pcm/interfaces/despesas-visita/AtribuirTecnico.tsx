import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { DespesaVisitaListada } from "../../infrastructure/supabase-despesas-visita-adapter";
import { HistoricoTecnicoDespesa } from "./HistoricoTecnicoDespesa";

export const esquemaAtribuicaoTecnico = z.object({ requestId: z.string().guid(), despesaId: z.string().guid(), visitaId: z.string().guid(),
  expectedRevision: z.number().int().positive(), participacaoId: z.string().guid().nullable(), motivo: z.string().trim().min(1).max(2000) }).strict();
const esquema = esquemaAtribuicaoTecnico;
type Pedido = z.infer<typeof esquema>;
type Props = { userId: string; clienteId: string; visitaId: string; despesa: DespesaVisitaListada };
export function AtribuirTecnico(props: Props) {
  if (import.meta.env.VITE_SSO_ATRIBUIR_TECNICO_DESPESA_ENABLED !== "true" || props.despesa.status !== "ativa") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesa.id])} {...props} />;
}
function Conteudo({ userId, clienteId, visitaId, despesa }: Props) {
  const chave = `sso-tecnico-despesa:${userId}:${clienteId}:${visitaId}:${despesa.id}`; const queryClient = useQueryClient();
  const [participacao, setParticipacao] = useState(""); const [motivo, setMotivo] = useState(""); const [mensagem, setMensagem] = useState("");
  const [consultandoRecibo,setConsultandoRecibo]=useState(false);
  const [confirmado, setConfirmado] = useState<string | null>(null); const trava=useRef(false);
  const mediado=import.meta.env.VITE_SSO_ATRIBUICAO_TECNICO_DESPESA_MEDIADA_ENABLED==="true";
  async function conferirSessao(signal?:AbortSignal){const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||signal?.aborted)throw new Error("Sessão alterada.");}
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = esquema.parse(JSON.parse(salvo)); return p.despesaId === despesa.id && p.visitaId === visitaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const equipe = useInfiniteQuery({ queryKey: ["despesas-visita", userId, clienteId, visitaId, "equipe-tecnico"], gcTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const parametros={p_cliente_id:clienteId,p_visita_id:visitaId,p_apos:pageParam};
      const requisicao=mediado?supabase.schema("pcm").rpc("sso_tecnicos_despesa_visita_mediado",{...parametros,p_ator_id:userId}):supabase.schema("pcm").rpc("sso_tecnicos_despesa_visita",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const pagina=z.array(z.object({ id: z.string().guid(), nome: z.string() }).strict()).max(20).parse(data);let anterior=pageParam?.toLowerCase()??"";
      for(const item of pagina){const id=item.id.toLowerCase();if(id<=anterior)throw new Error("Página divergente.");anterior=id;}await conferirSessao(signal);return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const atual = useQuery({ queryKey: ["despesas-visita", userId, clienteId, visitaId, despesa.id, "tecnico"], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { await conferirSessao(signal);const requisicao=mediado?supabase.schema("pcm").rpc("sso_atribuicao_tecnico_despesa_mediada",{p_ator_id:userId,p_cliente_id:clienteId,p_visita_id:visitaId,p_despesa_id:despesa.id}):supabase.schema("pcm").rpc("sso_atribuicao_tecnico_despesa",{p_despesa_id:despesa.id});const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const resultado=z.array(z.object({ participacao_id: z.string().guid().nullable(), tecnico_nome: z.string().nullable(),
        vigente: z.boolean().nullable(), revisao: z.number().int().positive() }).strict()).max(1).parse(data)[0] ?? null;await conferirSessao(signal);return resultado; } });
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");
    const parametros={p_request_id:p.requestId,p_despesa_id:p.despesaId,p_expected_revision:p.expectedRevision,p_participacao_id:p.participacaoId,p_motivo:p.motivo};
    const requisicao=mediado?supabase.schema("pcm").rpc("sso_atribuir_tecnico_despesa_mediada",{...parametros,p_ator_id:userId,p_cliente_id:clienteId,p_visita_id:visitaId}):supabase.schema("pcm").rpc("sso_atribuir_tecnico_despesa",parametros);
    const { data, error } = await requisicao;
    if (error) throw error;
    if (!data || data.aggregateId !== p.despesaId || data.revision !== p.expectedRevision + 1 || data.requestId !== p.requestId || data.linkedIds?.visitaId !== p.visitaId) throw new Error("Resposta inválida.");await conferirSessao();
  }, onSuccess: async (_resultado,p) => { try {await conferirSessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();sessionStorage.removeItem(chave); } catch { setMensagem("Atribuição salva; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setConfirmado(null);setMensagem("Atribuição registrada.");
    await queryClient.invalidateQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId] });
    await queryClient.invalidateQueries({ queryKey: ["relatorio-despesas-cliente", userId, clienteId] }); },
  onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."), onSettled:()=>{trava.current=false;} });
  const fotografia=JSON.stringify([userId,clienteId,visitaId,despesa.id,despesa.revisao,atual.data??null,participacao,motivo]);
  function registrar(p: Pedido,novo:boolean) { if(trava.current)return;try {const salvo=sessionStorage.getItem(chave);if(novo){if(salvo!==null)throw new Error();sessionStorage.setItem(chave, JSON.stringify(p));}else if(salvo!==JSON.stringify(p))throw new Error();} catch { setMensagem("Tentativa indisponível ou alterada; atribuição não enviada."); return; }
    trava.current=true;setPendente(p); setMensagem(""); enviar.mutate(p); }
  async function consultarRecibo(p:Pedido){if(trava.current)return;trava.current=true;setConsultandoRecibo(true);setMensagem("");try{
    await conferirSessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_recibo_tecnico_despesa",{p_ator_id:userId,p_cliente_id:clienteId,p_visita_id:visitaId,p_request_id:p.requestId,p_despesa_id:p.despesaId,p_expected_revision:p.expectedRevision,p_participacao_id:p.participacaoId,p_motivo:p.motivo});
    if(error||!data||data.aggregateId!==p.despesaId||data.revision!==p.expectedRevision+1||data.requestId!==p.requestId||data.linkedIds?.visitaId!==p.visitaId)throw new Error("Recibo indisponível.");
    await queryClient.invalidateQueries({queryKey:["despesas-visita",userId,clienteId,visitaId]});await queryClient.invalidateQueries({queryKey:["relatorio-despesas-cliente",userId,clienteId]});
    await conferirSessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");sessionStorage.removeItem(chave);setPendente(null);setConfirmado(null);setMensagem("Atribuição confirmada no histórico local; não comprova execução ou pagamento.");
  }catch{setMensagem("Não foi possível confirmar o recibo. A tentativa permanece guardada; consulte suporte.");}finally{trava.current=false;setConsultandoRecibo(false);}}
  return <form onSubmit={(e) => { e.preventDefault(); if (pendente || enviar.isPending || trava.current || confirmado!==fotografia || equipe.isFetching || equipe.isError || atual.isFetching || atual.isError || (participacao && !equipe.data?.pages.flat().some(item=>item.id===participacao))) return;
    try { registrar(esquema.parse({ requestId: crypto.randomUUID(), despesaId: despesa.id, visitaId,
      expectedRevision: despesa.revisao, participacaoId: participacao || null, motivo }),true); }
    catch { setMensagem("Confira técnico e motivo."); }
  }}><h5>Atribuição para relatório</h5><p>Não confirma execução nem pagamento. Selecione apenas o responsável quando conhecido.</p>
    {import.meta.env.VITE_SSO_HISTORICO_TECNICO_DESPESA_ENABLED === "true" && <HistoricoTecnicoDespesa userId={userId} clienteId={clienteId} visitaId={visitaId} despesaId={despesa.id} revisao={despesa.revisao} />}
    {(equipe.isError || atual.isError) && <p role="alert">Não foi possível consultar equipe ou atribuição atual.</p>}
    {!atual.isPending && !atual.isError && <p>Atribuição atual: {atual.data?.tecnico_nome ?? "sem atribuição"}{atual.data?.vigente === false ? " (vínculo encerrado)" : ""}.</p>}
    <fieldset disabled={!!pendente || enviar.isPending || equipe.isFetching || equipe.isError || atual.isFetching || atual.isError}>
      <label>Técnico <select value={participacao} onChange={(e) => setParticipacao(e.target.value)}><option value="">Sem atribuição</option>
        {equipe.data?.pages.flat().map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
      {equipe.hasNextPage && <button type="button" onClick={() => void equipe.fetchNextPage()}>Mais técnicos</button>}
      <label>Motivo <input maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label><input type="checkbox" checked={confirmado===fotografia} onChange={(e) => setConfirmado(e.target.checked?fotografia:null)} /> Confirmo a nova atribuição selecionada.</label>
      <button type="submit" disabled={confirmado!==fotografia}>Registrar atribuição</button>
    </fieldset>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <>{import.meta.env.VITE_SSO_RECIBO_TECNICO_DESPESA_ENABLED==="true"&&<button type="button" disabled={enviar.isPending||consultandoRecibo} onClick={()=>void consultarRecibo(pendente)}>Consultar recibo</button>}<button type="button" disabled={enviar.isPending||consultandoRecibo} onClick={() => registrar(pendente,false)}>Repetir tentativa</button></>}
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
