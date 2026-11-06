import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ id: z.string().min(1), funcionario_id: z.string().min(1), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hora_inicio: z.string().nullable(), hora_fim: z.string().nullable() });
type Cursor = { data: string; id: string } | null;

function dataCivil(valor: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000")) return Number.NaN;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor ? data.getTime() : Number.NaN;
}

export function AgendaTecnicoContexto({ userId, clienteId, semana }: { userId: string; clienteId: string; semana: string }) {
  return <Conteudo key={JSON.stringify([userId, clienteId, semana])} userId={userId} clienteId={clienteId} semana={semana} />;
}

function Conteudo({ userId, clienteId, semana }: { userId: string; clienteId: string; semana: string }) {
  const [tecnico, setTecnico] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaNome, setBuscaNome] = useState("");
  const [tecnicoServidor, setTecnicoServidor] = useState<string | null>(null);
  const [erroBusca, setErroBusca] = useState("");
  const filtroServidor = import.meta.env.VITE_SSO_FILTRO_TECNICO_AGENDA_ENABLED === "true";
  const tecnicosDisponiveis = useInfiniteQuery({ queryKey:["capacidade-agenda",userId,clienteId,"catalogo-filtrado",buscaNome], enabled:filtroServidor, gcTime:0,
    initialPageParam:null as {nome:string;id:string}|null,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_catalogo_tecnicos_agenda",{p_cliente_id:clienteId,p_busca:buscaNome,p_apos_nome:pageParam?.nome??null,p_apos_id:pageParam?.id??null,p_limite:50}).abortSignal(signal);
      if(error)throw error;const pagina=z.array(z.object({id:z.string().uuid(),nome:z.string().min(1)}).strict()).max(50).parse(data);
      if(new Set(pagina.map((item)=>item.id.toLowerCase())).size!==pagina.length||pagina.some((item)=>item.id.toLowerCase()===pageParam?.id.toLowerCase()))throw new Error("Página divergente.");
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;
    },getNextPageParam:(pagina)=>pagina.length===50&&pagina.at(-1)?{nome:pagina.at(-1)!.nome,id:pagina.at(-1)!.id}:undefined});
  const funcionarios=tecnicosDisponiveis.data?.pages.flat()??[];
  const q = useInfiniteQuery({
    queryKey: ["capacidade-agenda-tecnico", userId, clienteId, semana, tecnicoServidor], gcTime: 0,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const argumentos = { p_cliente_id: clienteId, p_semana_inicio: semana, p_apos_data: pageParam?.data ?? null, p_apos_id: pageParam?.id ?? null, p_limite: 50 };
      const consulta = tecnicoServidor ? supabase.schema("pcm").rpc("sso_listar_agenda_tecnico_filtrada", { ...argumentos, p_funcionario_id: tecnicoServidor }) : supabase.schema("pcm").rpc("sso_listar_agenda_tecnico_capacidade", argumentos);
      const { data, error } = await consulta.abortSignal(signal);
      if (error) throw error;
      const inicio = dataCivil(semana);
      if (!Number.isFinite(inicio) || new Date(inicio).getUTCDay() !== 1) throw new Error("Semana inválida.");
      const pagina = z.array(linha).max(50).parse(data);
      let anterior = pageParam;
      for (const item of pagina) {
        const dia = dataCivil(item.data);
        const id = item.id.toLowerCase();
        if (!Number.isFinite(dia) || dia < inicio || dia >= inicio + 7 * 86_400_000 || (tecnicoServidor && item.funcionario_id.toLowerCase() !== tecnicoServidor.toLowerCase()) ||
          (anterior && (item.data < anterior.data || (item.data === anterior.data && id <= anterior.id.toLowerCase()))))
          throw new Error("Página inválida.");
        anterior = { data: item.data, id };
      }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 && pagina.at(-1) ? { data: pagina.at(-1)!.data, id: pagina.at(-1)!.id } : undefined,
  });
  const alocacoes = !q.isError && !q.isFetching ? q.data?.pages.flat() ?? [] : [];
  const tecnicos = [...new Set(alocacoes.map((item) => item.funcionario_id))].sort();
  const exibidas = tecnico ? alocacoes.filter((item) => item.funcionario_id === tecnico) : alocacoes;
  return <section aria-label="Alocações da agenda do técnico">
    <h3>Alocações da agenda do técnico</h3>
    <p>Agenda manual do Cliente e da semana; não comprova disponibilidade nem execução preventiva. Horários não são descontados automaticamente.</p>
    {filtroServidor && <form onSubmit={(event)=>{event.preventDefault();const valor=busca.trim();if(tecnicosDisponiveis.isFetching||tecnicosDisponiveis.isError||!funcionarios.some((item)=>item.id===valor)){setErroBusca("Selecione um técnico disponível no cadastro consultado.");return;}setErroBusca("");setTecnico("");setTecnicoServidor(valor.toLowerCase());}}>
      {tecnicosDisponiveis.isFetching && <output>Carregando técnicos…</output>}
      {tecnicosDisponiveis.isError && <p role="alert">Cadastro de técnicos indisponível. <button type="button" onClick={()=>void tecnicosDisponiveis.refetch()}>Tentar novamente</button></p>}
      <label>Buscar nome <input maxLength={120} value={buscaNome} onChange={(event)=>{setBuscaNome(event.target.value);setBusca("");setErroBusca("");}} /></label>
      <label>Técnico <select value={busca} disabled={tecnicosDisponiveis.isFetching||tecnicosDisponiveis.isError} onChange={(event)=>{setBusca(event.target.value);setErroBusca("");}}><option value="">Selecione</option>{funcionarios.map((item)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      {tecnicosDisponiveis.hasNextPage&&<button type="button" disabled={tecnicosDisponiveis.isFetching} onClick={()=>void tecnicosDisponiveis.fetchNextPage()}>Mais técnicos</button>}
      <p>Cadastro consultado conforme acesso atual; resultados podem mudar entre páginas.</p>
      <button type="submit">Buscar na semana</button>{tecnicoServidor && <button type="button" onClick={()=>{setTecnicoServidor(null);setBusca("");setErroBusca("");}}>Mostrar todos</button>}
      {erroBusca && <p role="alert">{erroBusca}</p>}
    </form>}
    {tecnicoServidor && <p>Consulta no servidor para técnico {tecnicoServidor}; páginas podem mudar durante a navegação.</p>}
    {q.isPending && <output>Carregando agenda…</output>}
    {q.isError && <p role="alert">Agenda indisponível. <button type="button" onClick={() => void (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())}>Tentar novamente</button></p>}
    {q.data && !q.isError && !q.isFetching && <>
      {!tecnicoServidor && tecnicos.length > 0 && <label>Filtrar técnico nas páginas carregadas <select value={tecnico} onChange={(event) => setTecnico(event.target.value)}>
        <option value="">Todos</option>{tecnicos.map((id) => <option key={id} value={id}>{id}</option>)}
        {tecnico && !tecnicos.includes(tecnico) && <option value={tecnico}>Técnico não encontrado nas páginas atuais</option>}
      </select></label>}
      {exibidas.length > 0 ? <ul>{exibidas.map((a) => <li key={a.id}>Técnico {a.funcionario_id} · {a.data} · {a.hora_inicio ?? "início não informado"} a {a.hora_fim ?? "fim não informado"}</li>)}</ul> :
        <p>{tecnico ? "Nenhuma alocação carregada para este técnico." : "Sem alocações carregadas."} Isso não prova disponibilidade.</p>}
      {q.hasNextPage && tecnico && <p>O filtro considera apenas as páginas carregadas; podem existir outras alocações deste técnico.</p>}
    </>}
    {q.hasNextPage && !q.isError && <><button type="button" disabled={q.isFetching} onClick={() => void q.fetchNextPage()}>Mais alocações</button><p>Lista parcial: há outras páginas.</p></>}
  </section>;
}
