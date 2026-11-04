import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseListasMateriaisAdapter } from "../../infrastructure/supabase-listas-materiais-adapter";
import { WorkspaceListasMateriais } from "./Workspace";
import { ExcecoesOs } from "./ExcecoesOs";
import { OrcamentosDaOs } from "../../../comercial/interfaces/orcamento-operacional/OrcamentosDaOs";

type Props = { usuario: string; cliente: string; onAbrirOs?: (osId: string) => void };
type Responsavel = "cliente" | "sinergica" | "todos";
type EstadoLista = "todos" | "levantada" | "informada_disponivel" | "parcial" | "indisponivel";
const estadosLista: Record<string, string> = { levantada: "Levantada", informada_disponivel: "Disponibilidade informada", parcial: "Parcial", indisponivel: "Indisponível" };

function erroTemporario(error: unknown): boolean {
  if (error instanceof TypeError && /^(Failed to fetch|NetworkError)/i.test(error.message)) return true;
  if (typeof error !== "object" || error === null || !("status" in error)) return false;
  const status = error.status;
  return typeof status === "number" && [500, 502, 503, 504].includes(status);
}
async function consultarPermissaoMaterial(usuario:string,cliente:string) {
  const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario)throw new Error("Sessão alterada.");
  const permitido=await supabaseCapacidadesSsoAdapter.autorizarAcao("material.gerir",cliente);
  const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario)throw new Error("Sessão alterada.");
  return permitido;
}

export function CentralMateriais(props: Props) {
  if (import.meta.env.VITE_SSO_CENTRAL_MATERIAIS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente])} {...props} />;
}

/** Entrada na operação global, sempre limitada ao Cliente selecionado. */
export function CentralMateriaisGlobal(props: Props) {
  if (import.meta.env.VITE_SSO_CENTRAL_MATERIAIS_ENABLED !== "true") return null;
  return <CentralGlobalConteudo key={JSON.stringify([props.usuario, props.cliente])} {...props} />;
}

function CentralGlobalConteudo(props: Props) {
  const [aberta, setAberta] = useState(false);
  const permissao = useQuery({
    queryKey: ["listas-materiais-central", props.usuario, props.cliente, "permissao"],
    queryFn: () => consultarPermissaoMaterial(props.usuario,props.cliente),
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  if (permissao.isPending || permissao.isFetching) return <output>Verificando acesso aos materiais…</output>;
  if (permissao.isError) return <p role="alert">Não foi possível verificar acesso. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (permissao.data !== true) return <p>Sem permissão para consultar materiais deste Cliente.</p>;
  return <section aria-label="Materiais do Cliente selecionado">
    <button type="button" onClick={() => setAberta(!aberta)}>
      {aberta ? "Fechar Central de materiais" : "Abrir Central de materiais"}
    </button>
    {aberta && <Conteudo {...props} permissaoMonitorada />}
  </section>;
}

function Conteudo({ usuario, cliente, onAbrirOs, permissaoMonitorada = false }: Props & { permissaoMonitorada?: boolean }) {
  const [osDigitada, setOsDigitada] = useState("");
  const [os, setOs] = useState<string | null>(null);
  const [responsavel, setResponsavel] = useState<Responsavel>("todos");
  const [estado, setEstado] = useState<EstadoLista>("todos");
  const [aberta, setAberta] = useState<string | null>(null);
  const [orcamentoOs, setOrcamentoOs] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const filtroServidor = import.meta.env.VITE_SSO_CENTRAL_MATERIAIS_SITUACAO_ENABLED === "true";
  const permissao = useQuery({
    queryKey: ["listas-materiais-central", usuario, cliente, "permissao"],
    queryFn: () => consultarPermissaoMaterial(usuario,cliente),
    enabled: !permissaoMonitorada,
    gcTime: 0, refetchOnWindowFocus: true,
  });
  // Na entrada global o componente pai mantém a mesma consulta ativa e só
  // monta esta área enquanto a autorização atual está confirmada.
  const permitido = permissaoMonitorada || (permissao.data === true && !permissao.isFetching && !permissao.isError);
  const listas = useInfiniteQuery({
    queryKey: ["listas-materiais-central", usuario, cliente, os, responsavel, filtroServidor, filtroServidor ? estado : null],
    enabled: permitido, gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const pagina=await (filtroServidor
        ? supabaseListasMateriaisAdapter.consultarCentralPorSituacao(cliente, os, responsavel === "todos" ? null : responsavel, estado === "todos" ? null : estado, 20, pageParam, signal)
        : supabaseListasMateriaisAdapter.consultarCentral(cliente, os, responsavel === "todos" ? null : responsavel, 20, pageParam, signal));
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined,
  });
  if (!permissaoMonitorada && (permissao.isPending || permissao.isFetching)) return <output>Verificando acesso aos materiais…</output>;
  if (!permissaoMonitorada && permissao.isError) return <p role="alert">Não foi possível verificar acesso. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (!permitido) return null;
  const carregadas = listas.data?.pages.flat() ?? [];
  const visiveis = estado === "todos" ? carregadas : carregadas.filter((lista) => lista.estado === estado);
  return <section aria-label="Central de materiais">
    <h2>Central de materiais</h2>
    {import.meta.env.VITE_SSO_BUSCA_OS_MATERIAIS_ENABLED === "true" && <SelecionarOs usuario={usuario} cliente={cliente} onSelecionar={(id) => {
      setOsDigitada(id); setOs(id); setAberta(null); setOrcamentoOs(null); setErro("");
    }} />}
    <form onSubmit={(evento) => {
      evento.preventDefault();
      const valor = osDigitada.trim();
      if (valor && !z.string().uuid().safeParse(valor).success) { setErro("Informe o identificador UUID da OS ou deixe vazio."); return; }
      setErro(""); if((valor || null)===os) void listas.refetch(); else setOs(valor || null); setAberta(null); setOrcamentoOs(null);
    }}>
      <label>Identificador da OS <input value={osDigitada} onChange={(evento) => setOsDigitada(evento.target.value)} /></label>
      <label>Responsável <select value={responsavel} onChange={(evento) => { setResponsavel(evento.target.value as Responsavel); setAberta(null); setOrcamentoOs(null); }}>
        <option value="todos">Todos</option><option value="cliente">Cliente</option><option value="sinergica">Sinérgica</option>
      </select></label>
      <label>{filtroServidor ? "Situação" : "Situação nas páginas carregadas"} <select value={estado} onChange={(evento) => { setEstado(evento.target.value as EstadoLista); setAberta(null); setOrcamentoOs(null); }}>
        <option value="todos">Todas</option><option value="levantada">Levantada</option><option value="informada_disponivel">Disponibilidade informada</option><option value="parcial">Parcial</option><option value="indisponivel">Indisponível</option>
      </select></label>
      <button type="submit">Filtrar OS</button>
    </form>
    {erro && <p role="alert">{erro}</p>}
    {os && <ExcecoesOs usuario={usuario} cliente={cliente} os={os} />}
    {listas.isFetching && <output>Consultando listas…</output>}
    {listas.isError && <p role="alert">Não foi possível consultar listas. <button type="button" onClick={() => void (listas.isFetchNextPageError ? listas.fetchNextPage() : listas.refetch())}>Tentar novamente</button></p>}
    {!listas.isFetching && !listas.isError && listas.data?.pages.flat().length === 0 && <p>Nenhuma lista para estes filtros.</p>}
    {listas.data && !listas.isFetching && (!listas.isError || (listas.isFetchNextPageError && erroTemporario(listas.error))) && <>
    <p>{visiveis.length} lista(s) nas páginas carregadas{listas.hasNextPage ? "; carregue mais para ampliar a busca" : ""}.</p>
    {carregadas.length > 0 && visiveis.length === 0 && <p>Nenhuma lista carregada corresponde à situação selecionada.</p>}
    <ul>{visiveis.map((lista) => <li key={lista.id}>
      <p>OS {lista.ordem_servico_id} · {lista.responsavel === "cliente" ? "Cliente" : "Sinérgica"} · {estadosLista[lista.estado] ?? lista.estado} · revisão {lista.revisao}</p>
      <button type="button" onClick={() => { setOsDigitada(lista.ordem_servico_id); setOs(lista.ordem_servico_id); setAberta(null); setOrcamentoOs(null); setErro(""); }}>{import.meta.env.VITE_SSO_EXCECOES_MATERIAIS_OS_ENABLED === "true" ? "Filtrar esta OS e consultar exceções" : "Filtrar esta OS"}</button>
      {onAbrirOs && <button type="button" onClick={() => onAbrirOs(lista.ordem_servico_id)}>Abrir contexto da OS</button>}
      <pre>{lista.texto_original}</pre>
      {import.meta.env.VITE_SSO_LISTAS_MATERIAIS_ENABLED === "true" && <button type="button" onClick={() => { if (aberta === lista.id) { setAberta(null); void listas.refetch(); } else setAberta(lista.id); }}>{aberta === lista.id ? "Fechar materiais da OS" : "Abrir materiais da OS"}</button>}
      {aberta === lista.id && <WorkspaceListasMateriais usuario={usuario} cliente={cliente} ordemServico={lista.ordem_servico_id} />}
      {lista.responsavel === "sinergica" && import.meta.env.VITE_SSO_ORCAMENTO_OPERACIONAL_ENABLED === "true" && <>
        <button type="button" onClick={() => setOrcamentoOs(orcamentoOs === lista.id ? null : lista.id)}>{orcamentoOs === lista.id ? "Fechar orçamentos da OS" : "Consultar orçamentos da OS"}</button>
        {orcamentoOs === lista.id && <><p>O orçamento é da OS; confira a lista de materiais e sua revisão na criação. Não gera despesa de Visita ou cobrança automaticamente.</p><OrcamentosDaOs key={lista.id} usuario={usuario} cliente={cliente} ordemServico={lista.ordem_servico_id} listaInicialId={lista.id}/></>}
      </>}
    </li>)}</ul></>}
    {!listas.isFetching && !listas.isError && listas.hasNextPage && <button type="button" onClick={() => void listas.fetchNextPage()}>Carregar mais listas</button>}
  </section>;
}

function SelecionarOs({usuario,cliente,onSelecionar}:{usuario:string;cliente:string;onSelecionar:(id:string)=>void}) {
  const [texto,setTexto]=useState("");
  const [busca,setBusca]=useState("");
  const consulta=useInfiniteQuery({
    queryKey:["listas-materiais-central",usuario,cliente,"busca-os",busca],
    initialPageParam:null as string | null, gcTime:0,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
      const pagina=await supabaseListasMateriaisAdapter.buscarOsCentral(cliente,busca,20,pageParam,signal);const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(pagina)=>pagina.length===20 ? pagina.at(-1)?.id : undefined,
  });
  return <section aria-label="Selecionar OS com materiais"><h3>Selecionar OS</h3>
    <p>Busca apenas OS deste Cliente que já possuem lista de materiais.</p>
    <form onSubmit={(evento)=>{evento.preventDefault();const valor=texto.trim();if(valor===busca)void consulta.refetch();else setBusca(valor);}}><label>Número da OS <input maxLength={80} value={texto} onChange={(evento)=>setTexto(evento.target.value)} /></label><button type="submit">Buscar OS</button></form>
    {consulta.isFetching && <output>Buscando OS…</output>}
    {consulta.isError && <p role="alert">Não foi possível buscar OS. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length===0 && <p>Nenhuma OS com lista encontrada.</p>}
    {!consulta.isFetching && !consulta.isError && <ul>{consulta.data?.pages.flat().map((item)=><li key={item.id}>{item.numero} · {item.titulo} <button type="button" onClick={()=>onSelecionar(item.id)}>Selecionar {item.numero}</button></li>)}</ul>}
    {!consulta.isFetching && !consulta.isError && consulta.hasNextPage && <button type="button" onClick={()=>void consulta.fetchNextPage()}>Mais OS</button>}
  </section>;
}
