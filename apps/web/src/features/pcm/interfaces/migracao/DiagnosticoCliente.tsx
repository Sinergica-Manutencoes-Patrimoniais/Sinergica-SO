import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { MatrizCenarios } from "./MatrizCenarios";
import { EvidenciasOnda } from "./EvidenciasOnda";
import { RelatorioPrevia } from "./RelatorioPrevia";
import { RascunhoPlanoLegado } from "./RascunhoPlanoLegado";
import { LoteRascunhosLegados } from "./LoteRascunhosLegados";
import { ReversaoLotesLegados } from "./ReversaoLotesLegados";
import { CanonicalizarVinculoLegado } from "../chamados-os/CanonicalizarVinculoLegado";
import { MapaPlanosLegados } from "./MapaPlanosLegados";
import { useState } from "react";

const campos = {
  chamadosAtivos:"Chamados não excluídos", osAtivas:"OS não excluídas",
  osChamadoAusente:"OS com Chamado ausente ou excluído", osChamadoClienteDivergente:"OS com Cliente divergente do Chamado",
  chamadoOsLegadaAusente:"Chamados com OS legada ausente ou excluída", chamadoOsLegadaDivergente:"Chamados com referência legada divergente ou sem vínculo inverso",
  osLegadaMultiplosChamados:"OS legadas referenciadas por múltiplos Chamados deste Cliente",
  codigosVazios:"Códigos vazios", possiveisCodigosDuplicadosCliente:"Grupos de possíveis códigos duplicados neste Cliente",
  planosPreventivosAlvoInvalido:"Planos preventivos com alvo indisponível ou de outro Cliente",
} as const;

export function DiagnosticoCliente({userId,clienteId}:{userId:string;clienteId:string}) {
  const [planoSelecionado,setPlanoSelecionado]=useState<string|null>(null);
  const [chamadoSelecionado,setChamadoSelecionado]=useState<string|null>(null);
  const [somenteReferenciasParaConferencia,setSomenteReferenciasParaConferencia]=useState(false);
  const mediado=import.meta.env.VITE_SSO_PREFLIGHT_MIGRACAO_MEDIADO_ENABLED === "true";
  const conferirSessao=async(signal:AbortSignal)=>{const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");};
  const conferirPagina=(ids:string[],apos:string|null)=>{const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;let anterior=apos?.toLowerCase()??"";
    if(ids.length>50)throw new Error("Página inválida.");for(const id of ids){if(!uuid.test(id)||id.toLowerCase()<=anterior)throw new Error("Página inválida.");anterior=id.toLowerCase();}};
  const consulta=useQuery({queryKey:["migracao-preflight",userId,clienteId],gcTime:0,refetchOnWindowFocus:true,
    queryFn:async ({signal}) => {await conferirSessao(signal);const {data,error}=await supabase.schema("pcm").rpc(mediado?"sso_diagnostico_migracao_mediado":"sso_diagnosticar_migracao_cliente",{p_cliente_id:clienteId,...(mediado?{p_ator_id:userId}:{})}).abortSignal(signal);
      if(error) throw error;
      if(!data || data.clienteId!==clienteId || data.abrangencia!=="parcial_por_cliente" ||
        Object.keys(campos).some((key) => !Number.isSafeInteger(data[key]) || data[key]<0)) throw new Error("Diagnóstico inválido.");
      await conferirSessao(signal);return data as Record<keyof typeof campos,number>;}});
  const referencias=useInfiniteQuery({queryKey:["migracao-preflight-referencias",userId,clienteId],gcTime:0,initialPageParam:null as string | null,
    queryFn:async ({pageParam,signal}) => {await conferirSessao(signal);const {data,error}=await supabase.schema("pcm").rpc(mediado?"sso_prever_referencias_mediada":"sso_prever_referencias_chamado_os",{
      p_cliente_id:clienteId,p_apos:pageParam,p_limite:50,...(mediado?{p_ator_id:userId}:{})}).abortSignal(signal);
      if(error) throw error; if(!Array.isArray(data) || data.some((r) => typeof r.chamado_id!=="string" || typeof r.classificacao!=="string" || !Number.isSafeInteger(r.os_relacionadas) || r.os_relacionadas<0)) throw new Error("Prévia inválida.");
      conferirPagina(data.map((r)=>r.chamado_id),pageParam);await conferirSessao(signal);
      return data as {chamado_id:string;os_legada_id:string | null;os_relacionadas:number;classificacao:string}[];},
    getNextPageParam:(pagina) => pagina.length===50 ? pagina.at(-1)?.chamado_id : undefined});
  const codigos=useQuery({queryKey:["migracao-preflight-codigos",userId,clienteId],gcTime:0,refetchOnWindowFocus:true,
    queryFn:async ({signal}) => {await conferirSessao(signal);const {data,error}=await supabase.schema("pcm").rpc(mediado?"sso_preflight_codigos_mediado":"sso_preflight_codigos_entre_clientes",{p_cliente_id:clienteId,...(mediado?{p_ator_id:userId}:{})}).abortSignal(signal);
      if(error) throw error; if(!data || data.clienteId!==clienteId || !Number.isSafeInteger(data.chavesComPossivelCoincidenciaExterna) || data.chavesComPossivelCoincidenciaExterna<0) throw new Error("Diagnóstico inválido."); await conferirSessao(signal);return data.chavesComPossivelCoincidenciaExterna as number;}});
  const planos=useInfiniteQuery({queryKey:["migracao-preflight-planos",userId,clienteId],gcTime:0,initialPageParam:null as string | null,
    queryFn:async ({pageParam,signal}) => {await conferirSessao(signal);const {data,error}=await supabase.schema("pcm").rpc(mediado?"sso_prever_planos_legados_mediada":"sso_prever_planos_preventivos_legados",{
      p_cliente_id:clienteId,p_apos:pageParam,p_limite:50,...(mediado?{p_ator_id:userId}:{})}).abortSignal(signal);
      if(error) throw error; if(!Array.isArray(data) || data.some((p) => typeof p.plano_id!=="string" || typeof p.classificacao!=="string" || !Number.isSafeInteger(p.ocorrencias) || p.ocorrencias<0)) throw new Error("Prévia inválida.");
      conferirPagina(data.map((p)=>p.plano_id),pageParam);await conferirSessao(signal);
      return data as {plano_id:string;estado:string;alvo_tipo:string;alvo_id:string | null;ocorrencias:number;classificacao:string}[];},
    getNextPageParam:(pagina) => pagina.length===50 ? pagina.at(-1)?.plano_id : undefined});
  const ordemDivergente=(ids:string[])=>ids.some((id,i)=>i>0 && id.toLowerCase()<=ids[i-1]!.toLowerCase());
  const referenciasDivergentes=ordemDivergente((referencias.data?.pages.flat()??[]).map(r=>r.chamado_id));
  const planosDivergentes=ordemDivergente((planos.data?.pages.flat()??[]).map(p=>p.plano_id));
  return <section aria-label="Diagnóstico parcial de migração"><h2>Diagnóstico parcial de migração</h2><MatrizCenarios /><EvidenciasOnda userId={userId} clienteId={clienteId} />
    <p>Leitura agregada deste Cliente. Não verifica unicidade global de códigos ou todos os vínculos, não infere Visitas nem migra dados.</p>
    {consulta.isFetching && <output>Consultando diagnóstico…</output>}
    {consulta.isError && <p role="alert">Diagnóstico indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <dl>{Object.entries(campos).map(([key,label]) =>
      <div key={key}><dt>{label}</dt><dd>{consulta.data[key as keyof typeof campos]}</dd></div>)}</dl>}
    <h3>Prévia de referências Chamado/OS</h3>
    <p>Classificação local e parcial; não verifica repetição fora do Cliente nem autoriza migração ou correção.</p>
    <label><input type="checkbox" checked={somenteReferenciasParaConferencia} onChange={(e)=>setSomenteReferenciasParaConferencia(e.target.checked)} /> Mostrar somente referências que exigem conferência nas páginas carregadas</label>
    {referencias.isFetching && <output>Carregando referências…</output>}
    {referencias.isError && <p role="alert">Prévia indisponível. <button type="button" onClick={() => void referencias.refetch()}>Tentar novamente</button></p>}
    {referenciasDivergentes && !referencias.isFetching && <p role="alert">Páginas de referências divergentes; reconsulte antes de usar a prévia. <button type="button" onClick={()=>void referencias.refetch()}>Reconsultar</button></p>}
    {referencias.data && !referencias.isFetching && !referencias.isError && !referenciasDivergentes && <ul>{referencias.data.pages.flat().filter((r)=>!somenteReferenciasParaConferencia || !["referencia_coerente","sem_referencia_singular"].includes(r.classificacao)).map((r) => <li key={r.chamado_id}>
      Chamado {r.chamado_id} · OS legada {r.os_legada_id ?? "não exposta"} · {r.os_relacionadas} OS relacionadas · {r.classificacao}
      {import.meta.env.VITE_SSO_CANONICALIZAR_CHAMADO_ENABLED === "true" && r.classificacao === "vinculo_inverso_ausente" && <button type="button" onClick={() => setChamadoSelecionado((atual) => atual === r.chamado_id ? null : r.chamado_id)}>{chamadoSelecionado === r.chamado_id ? "Fechar regularização" : "Conferir regularização"}</button>}
    </li>)}</ul>}
    {chamadoSelecionado && <CanonicalizarVinculoLegado usuario={userId} cliente={clienteId} chamado={chamadoSelecionado} />}
    {somenteReferenciasParaConferencia && referencias.hasNextPage && <p>O filtro cobre apenas páginas carregadas; podem existir outras referências para conferir.</p>}
    {referencias.hasNextPage && !referenciasDivergentes && <button type="button" disabled={referencias.isFetching} onClick={() => void referencias.fetchNextPage()}>Mais referências</button>}
    {referencias.data && !referencias.isFetching && !referencias.isError && !referenciasDivergentes && <RelatorioPrevia userId={userId} clienteId={clienteId} tipo="referencias" parcial={!!referencias.hasNextPage} disponivel={!referencias.isFetching&&!referencias.isError&&!referenciasDivergentes}
      registros={referencias.data.pages.flat().map((r)=>({id:r.chamado_id,classificacao:r.classificacao,dados:{osLegadaId:r.os_legada_id,osRelacionadas:r.os_relacionadas}}))} />}
    <h3>Códigos entre Clientes</h3>
    <p>Contagem agregada de possíveis coincidências após comparação por caixa e espaços; não inclui registros sem Cliente e não comprova duplicidade.</p>
    {codigos.isFetching && <output>Conferindo códigos…</output>}
    {codigos.isError && <p role="alert">Comparação indisponível. <button type="button" onClick={() => void codigos.refetch()}>Tentar novamente</button></p>}
    {codigos.data !== undefined && !codigos.isFetching && !codigos.isError && <p>Chaves com possível coincidência externa: {codigos.data}</p>}
    <MapaPlanosLegados userId={userId} clienteId={clienteId} />
    <h3>Planos preventivos legados</h3><p>Somente inventário parcial; nenhuma conversão ou vínculo foi criado.</p>
    {planos.isFetching && <output>Carregando planos…</output>}
    {planos.isError && <p role="alert">Prévia indisponível. <button type="button" onClick={() => void planos.refetch()}>Tentar novamente</button></p>}
    {planosDivergentes && !planos.isFetching && <p role="alert">Páginas de Planos divergentes; reconsulte antes de preparar rascunhos. <button type="button" onClick={()=>void planos.refetch()}>Reconsultar</button></p>}
    {planos.data && !planos.isFetching && !planos.isError && !planosDivergentes && <ul>{planos.data.pages.flat().map((p) => <li key={p.plano_id}>
      Plano {p.plano_id} · {p.estado} · {p.alvo_tipo} {p.alvo_id ?? "não exposto"} · {p.ocorrencias} ocorrências · {p.classificacao}
      {import.meta.env.VITE_SSO_RASCUNHO_PLANO_LEGADO_ENABLED === "true" && p.classificacao === "alvo_coerente_migracao_nao_planejada" && <button type="button" onClick={()=>setPlanoSelecionado((atual)=>atual===p.plano_id?null:p.plano_id)}>{planoSelecionado===p.plano_id?"Fechar rascunho":"Preparar rascunho"}</button>}
    </li>)}</ul>}
    {import.meta.env.VITE_SSO_RASCUNHO_PLANO_LEGADO_ENABLED === "true" && planoSelecionado && <RascunhoPlanoLegado userId={userId} clienteId={clienteId} planoId={planoSelecionado}
      disponivel={!planos.isFetching && !planos.isError && !planosDivergentes && !!planos.data?.pages.flat().some((p) => p.plano_id === planoSelecionado)}
      elegivel={!planosDivergentes && !!planos.data?.pages.flat().some((p) => p.plano_id === planoSelecionado && p.classificacao === "alvo_coerente_migracao_nao_planejada")} />}
    {planos.hasNextPage && !planosDivergentes && <button type="button" disabled={planos.isFetching} onClick={() => void planos.fetchNextPage()}>Mais planos</button>}
    {import.meta.env.VITE_SSO_LOTE_RASCUNHOS_LEGADOS_ENABLED === "true" && <LoteRascunhosLegados userId={userId} clienteId={clienteId} disponivel={!!planos.data && !planos.isFetching && !planos.isError && !planosDivergentes} planos={!planos.isFetching && !planos.isError && !planosDivergentes ? planos.data?.pages.flat() ?? [] : []} />}
    {import.meta.env.VITE_SSO_REVERSAO_LOTE_LEGADO_ENABLED === "true" && <ReversaoLotesLegados userId={userId} clienteId={clienteId} />}
    {planos.data && !planos.isFetching && !planos.isError && !planosDivergentes && <RelatorioPrevia userId={userId} clienteId={clienteId} tipo="planos" parcial={!!planos.hasNextPage} disponivel={!planos.isFetching&&!planos.isError&&!planosDivergentes}
      registros={planos.data.pages.flat().map((p)=>({id:p.plano_id,classificacao:p.classificacao,dados:{estado:p.estado,alvoTipo:p.alvo_tipo,alvoId:p.alvo_id,ocorrencias:p.ocorrencias}}))} />}
  </section>;
}
