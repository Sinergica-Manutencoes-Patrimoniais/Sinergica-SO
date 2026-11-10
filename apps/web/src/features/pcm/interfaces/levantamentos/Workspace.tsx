import { Conferencia } from "./Conferencia";
import { DecisaoLinha } from "./DecisaoLinha";
import { CodigoProvisorio } from "./CodigoProvisorio";
import { DiagnosticoLote } from "./Diagnostico";
import { ConsolidarLote } from "./ConsolidarLote";
import { ConferirSelecao } from "./ConferirSelecao";
import { EditarLinha } from "./EditarLinha";
import { EditarAtributos } from "./EditarAtributos";
import { HistoricoAtributos } from "./HistoricoAtributos";
import { LinhasEditadasLote } from "./LinhasEditadasLote";
import { IncorporacaoLocalizacao } from "./IncorporacaoLocalizacao";
import { IncorporacaoAtivo } from "./IncorporacaoAtivo";
import { RejeicaoLevantamento } from "./Rejeicao";
import { ReabrirRejeicao } from "./ReabrirRejeicao";
import { VincularAtivo } from "./VincularAtivo";
import { CamposSistemaStaging } from "./CamposSistemaStaging";
import { CamposComponenteStaging } from "./CamposComponenteStaging";
import { BuscarCodigoGrupo } from "./BuscarCodigoGrupo";
import { FotosLevantamento } from "./FotosLevantamento";
import { ReferenciasCampo } from "./ReferenciasCampo";
import { ResumoFotosLote } from "./ResumoFotosLote";
import { DocumentosLevantamento } from "./DocumentosLevantamento";
import { AtualizacaoLote } from "./AtualizacaoLote";
import { CriacaoLocalizacoesLote } from "./CriacaoLocalizacoesLote";
import { CriacaoAtivosLote } from "./CriacaoAtivosLote";
import { CriacaoGruposLote } from "./CriacaoGruposLote";
import { AtualizacaoGruposLote } from "./AtualizacaoGruposLote";
import { ConferenciaCodigosLote } from "./ConferenciaCodigosLote";
import { CamposLocalizacaoStaging } from "./CamposLocalizacaoStaging";
import { ConferirCamposLocalizacao } from "./ConferirCamposLocalizacao";
import { AplicarCamposLocalizacao } from "./AplicarCamposLocalizacao";
import { AplicarLocalizacoesLote } from "./AplicarLocalizacoesLote";
import { CodigoGrupoPendente } from "./CodigoGrupoPendente";
import { DiagnosticoCodigosGrupo } from "./DiagnosticoCodigosGrupo";
import { CorrigirCodigoStaging } from "./CorrigirCodigoStaging";
import { AprovacaoParcial, SelecionarAprovacaoParcial } from "./AprovacaoParcial";
import { ReservaCodigoLinha } from "./ReservaCodigoLinha";
import { RecuperarVinculosLocalizacao } from "./RecuperarVinculosLocalizacao";

type Lote = { id: string; origem: string; chaveOrigem: string; revisao: number; criadoEm: string };
type Linha = { chave: string; tipo: string; atributos: Record<string, unknown> };
type Gateway = {
  consultarLoteRecebido?(usuario:string, cliente:string, lote:string, signal?:AbortSignal):Promise<Lote>;
  listarLotes(
    cliente: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<Lote[]>;
  listarLinhas(
    cliente: string,
    lote: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<Linha[]>;
};
export function LevantamentosWorkspace(props: {
  userId: string;
  clienteId: string;
  gateway: Gateway;
  loteRecebido?: string | null;
}) {
  return <Conteudo key={`${props.userId}:${props.clienteId}`} {...props} />;
}

function Conteudo({
  userId,
  clienteId,
  gateway,
  loteRecebido,
}: { userId: string; clienteId: string; gateway: Gateway; loteRecebido?: string | null }) {
  const [lote, setLote] = useState<string | null>(null);
  const recebidoAberto = useRef<string | null>(null);
  const erroListaRevalidado = useRef(0);
  const linhasElementos = useRef(new Map<string,HTMLElement>());
  const [revisarLinha,setRevisarLinha]=useState<{loteId:string;chave:string} | null>(null);
  const lotes = useInfiniteQuery({
    queryKey: ["levantamentos", userId, clienteId, "lotes"],
    enabled: Boolean(userId && clienteId),
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => gateway.listarLotes(clienteId, 20, pageParam, signal),
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  const consultaDireta = useQuery({
    queryKey:["levantamentos",userId,clienteId,"lote-recebido",loteRecebido],
    enabled:import.meta.env.VITE_SSO_CONSULTA_LOTE_RECEBIDO_ENABLED === "true" && Boolean(userId && clienteId && loteRecebido && gateway.consultarLoteRecebido),
    gcTime:0, retry:false, refetchOnWindowFocus:true,
    queryFn:({signal})=>gateway.consultarLoteRecebido!(userId,clienteId,loteRecebido!,signal),
  });
  useEffect(()=>{
    if(lotes.isError && loteRecebido && import.meta.env.VITE_SSO_CONSULTA_LOTE_RECEBIDO_ENABLED === "true" && gateway.consultarLoteRecebido && erroListaRevalidado.current !== lotes.errorUpdatedAt){
      erroListaRevalidado.current=lotes.errorUpdatedAt;
      void consultaDireta.refetch();
    }
  },[lotes.isError,lotes.errorUpdatedAt,loteRecebido,gateway.consultarLoteRecebido,consultaDireta.refetch]);
  const diretaAtual = !lotes.isError || consultaDireta.dataUpdatedAt > lotes.errorUpdatedAt;
  const loteDireto = diretaAtual && !consultaDireta.isFetching && !consultaDireta.isError && consultaDireta.data?.id===loteRecebido ? consultaDireta.data : undefined;
  const listaDisponivel = !lotes.isFetching && !lotes.isError;
  const loteNaLista = listaDisponivel ? lotes.data?.pages.flat().find((item) => item.id === lote) : undefined;
  // A consulta direta é independente, mas não substitui uma lista em revalidação.
  // Se ambas responderam, a lista tem precedência para não restaurar revisão antiga.
  const loteAtual = loteNaLista ?? (!lotes.isFetching && loteDireto?.id === lote ? loteDireto : undefined);
  const recebidoNaLista = listaDisponivel && loteRecebido ? lotes.data?.pages.flat().some(item=>item.id===loteRecebido) : false;
  useEffect(()=>{if(loteRecebido && recebidoAberto.current!==loteRecebido && !lotes.isFetching && (recebidoNaLista || loteDireto)){recebidoAberto.current=loteRecebido;setLote(loteRecebido);}},[loteRecebido,recebidoNaLista,loteDireto,lotes.isFetching]);
  const loteConfirmado = Boolean(loteAtual);
  const linhas = useInfiniteQuery({
    queryKey: ["levantamentos", userId, clienteId, "linhas", lote, loteAtual?.revisao],
    enabled: loteConfirmado,
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      gateway.listarLinhas(clienteId, lote ?? "", 20, pageParam, signal),
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.chave : undefined),
  });
  useEffect(()=>{if(!revisarLinha || revisarLinha.loteId!==loteAtual?.id || linhas.isFetching || linhas.isError)return;const elemento=linhasElementos.current.get(revisarLinha.chave);if(elemento){elemento.scrollIntoView({block:"start"});elemento.focus({preventScroll:true});setRevisarLinha(null);}},[revisarLinha,loteAtual?.id,linhas.data,linhas.isFetching,linhas.isError]);
  return (
    <section>
      <h2>Levantamentos pendentes</h2>
      <RecuperarVinculosLocalizacao userId={userId} clienteId={clienteId} />
      <BuscarCodigoGrupo userId={userId} clienteId={clienteId}/>
      <p>Os dados recebidos ficam em conferência; uma linha pode já ter sido incorporada após decisão do PCM.</p>
      {lotes.isFetching && <output>Carregando levantamentos…</output>}
      {lotes.isError && (
        <div role="alert">
          Não foi possível carregar os levantamentos.{" "}
          <button type="button" onClick={() => void lotes.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {lotes.isError && loteAtual && loteDireto?.id === loteAtual.id && <p role="status">Lista geral indisponível. O lote recebido está aberto pela consulta direta; outros levantamentos não estão disponíveis.</p>}
      {!lotes.isFetching && !lotes.isError && lotes.data?.pages.flat().length === 0 && (
        <p>Nenhum levantamento recebido.</p>
      )}
      {!lotes.isFetching &&
        !lotes.isError &&
        lotes.data?.pages.flat().map((item) => (
          <button key={item.id} type="button" onClick={() => setLote(item.id)}>
            {item.origem === "manual"
              ? "Recepção manual · origem declarada não disponível (não verificada)"
              : `Origem declarada: ${item.origem} (não verificada)`}{" "}
            · {item.chaveOrigem} · revisão {item.revisao}
          </button>
        ))}
      {!lotes.isFetching && !lotes.isError && lotes.hasNextPage && (
        <button type="button" onClick={() => void lotes.fetchNextPage()}>
          Carregar mais levantamentos
        </button>
      )}
      {loteRecebido && !recebidoNaLista && !loteDireto && !lotes.isFetching && !lotes.isError && <p role="status">O lote recém-recebido ainda não está nas páginas carregadas. {lotes.hasNextPage ? "Carregue mais levantamentos para abri-lo." : "Não foi encontrado nesta consulta; confira o acesso e tente atualizar."}</p>}
      {consultaDireta.isError && <p role="alert">Não foi possível consultar diretamente o lote recebido. <button type="button" onClick={()=>void consultaDireta.refetch()}>Tentar novamente</button></p>}
      {loteAtual && <AtualizacaoLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao}>
      <AtualizacaoGruposLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao}>
      <CriacaoAtivosLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao}>
      <CriacaoGruposLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao}>
      <AplicarLocalizacoesLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao}>
      <AprovacaoParcial userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao}>
      <CriacaoLocalizacoesLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao} linhas={linhas.data?.pages.flat() ?? []} />
      {loteConfirmado && linhas.isFetching && <output>Carregando linhas…</output>}
      {loteAtual && <DiagnosticoLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao} onRevisar={(chave)=>setRevisarLinha({loteId:loteAtual.id,chave})} />}
      <ConferenciaCodigosLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao} onRevisar={(chave)=>setRevisarLinha({loteId:loteAtual.id,chave})} />
      <DiagnosticoCodigosGrupo userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao} onRevisar={(chave)=>setRevisarLinha({loteId:loteAtual.id,chave})} />
      {loteAtual && <ResumoFotosLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} />}
      {loteAtual && <LinhasEditadasLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao} onRevisar={(chave)=>setRevisarLinha({loteId:loteAtual.id,chave})} />}
      {revisarLinha?.loteId===loteAtual?.id && !linhas.isFetching && !linhasElementos.current.has(revisarLinha.chave) && <p role="status">A linha selecionada ainda não está nas páginas carregadas. {linhas.hasNextPage ? <button type="button" onClick={()=>void linhas.fetchNextPage()}>Carregar mais linhas para revisão</button> : "Não foi encontrada nesta consulta; atualize o lote."}</p>}
      {loteAtual && <ConsolidarLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao} />}
      <ConferirSelecao userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao} linhas={linhas.data?.pages.flat() ?? []} carregando={linhas.isFetching || linhas.isError} />
      {loteConfirmado && linhas.isError && (
        <div role="alert">
          Não foi possível carregar as linhas.{" "}
          <button type="button" onClick={() => void linhas.refetch()}>
            Tentar linhas novamente
          </button>
        </div>
      )}
      {loteConfirmado &&
        !linhas.isFetching &&
        !linhas.isError &&
        linhas.data?.pages.flat().length === 0 && <p>Nenhuma linha recebida.</p>}
      {loteConfirmado &&
        !linhas.isFetching &&
        !linhas.isError &&
        linhas.data?.pages.flat().map((linha) => (
          <article key={linha.chave} tabIndex={-1} ref={(el)=>{if(el)linhasElementos.current.set(linha.chave,el);else linhasElementos.current.delete(linha.chave);}}>
            <h3>
              {linha.tipo} · {linha.chave}
            </h3>
            <dl>
              {Object.entries(linha.atributos).map(([nome, valor]) => (
                <div key={nome}>
                  <dt>{nome}</dt>
                  <dd>{valor == null ? "Não informado" : String(valor)}</dd>
                </div>
              ))}
            </dl>
            {loteAtual && <DecisaoLinha userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} />}
            {loteAtual && <ReabrirRejeicao userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} />}
            {loteAtual && <ConsolidarLote userId={userId} clienteId={clienteId} loteId={loteAtual.id} revisao={loteAtual.revisao} linha={linha} />}
            {loteAtual && <SelecionarAprovacaoParcial userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} atributos={linha.atributos} />}
            {loteAtual && <CodigoProvisorio userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} tipo={linha.tipo} />}
            {loteAtual && <ReservaCodigoLinha userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} tipo={linha.tipo} />}
            {loteAtual && <CorrigirCodigoStaging userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} tipo={linha.tipo} atributos={linha.atributos} />}
            {loteAtual && <CodigoGrupoPendente userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} tipo={linha.tipo} atributos={linha.atributos} />}
            {loteAtual && <EditarLinha userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} atributos={linha.atributos} />}
            {loteAtual && <EditarAtributos userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} atributos={linha.atributos} />}
            {loteAtual && <EditarAtributos userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} atributos={linha.atributos} aposParcial />}
            {loteAtual && <HistoricoAtributos userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} />}
            {loteAtual && <ReferenciasCampo userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} />}
            {loteAtual && <FotosLevantamento userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} />}
            {loteAtual && <DocumentosLevantamento userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} />}
            {import.meta.env.VITE_SSO_CONFERENCIA_LEVANTAMENTOS_ENABLED === "true" && loteAtual && (
              <Conferencia
                key={`${loteAtual.id}:${linha.chave}`}
                userId={userId}
                clienteId={clienteId}
                loteId={loteAtual.id}
                chave={linha.chave}
                revisao={loteAtual.revisao}
              />
            )}
            {loteAtual && (
              <IncorporacaoLocalizacao
                userId={userId}
                clienteId={clienteId}
                loteId={loteAtual.id}
                chave={linha.chave}
                tipo={linha.tipo}
                revisao={loteAtual.revisao}
              />
            )}
            {loteAtual && <IncorporacaoAtivo userId={userId} clienteId={clienteId} loteId={loteAtual.id}
              chave={linha.chave} tipo={linha.tipo} revisao={loteAtual.revisao} atributos={linha.atributos} />}
            {loteAtual && <VincularAtivo userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} revisao={loteAtual.revisao} tipo={linha.tipo} atributos={linha.atributos} />}
            {loteAtual && <CamposSistemaStaging userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} tipo={linha.tipo} />}
            {loteAtual && <CamposLocalizacaoStaging userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} tipo={linha.tipo} revisao={loteAtual.revisao} />}
            {loteAtual && <ConferirCamposLocalizacao userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} tipo={linha.tipo} revisao={loteAtual.revisao} />}
            {loteAtual && <AplicarCamposLocalizacao userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} tipo={linha.tipo} revisao={loteAtual.revisao} atributos={linha.atributos} />}
            {loteAtual && <CamposComponenteStaging userId={userId} clienteId={clienteId} loteId={loteAtual.id} chave={linha.chave} tipo={linha.tipo} />}
            {loteAtual && (
              <RejeicaoLevantamento
                userId={userId}
                clienteId={clienteId}
                loteId={loteAtual.id}
                chave={linha.chave}
                revisao={loteAtual.revisao}
              />
            )}
          </article>
        ))}
      {loteConfirmado && !linhas.isFetching && !linhas.isError && linhas.hasNextPage && (
        <button type="button" onClick={() => void linhas.fetchNextPage()}>
          Carregar mais linhas
        </button>
      )}
      </AprovacaoParcial></AplicarLocalizacoesLote></CriacaoGruposLote></CriacaoAtivosLote></AtualizacaoGruposLote></AtualizacaoLote>}
    </section>
  );
}
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
