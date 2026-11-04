import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { DeclaracaoEscopoPreventivo } from "./DeclaracaoEscopoPreventivo";
import { MaterializarCicloCanonico } from "./MaterializarCicloCanonico";

const dataCivil=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s)=>{const t=Date.parse(`${s}T00:00:00Z`);return !s.startsWith("0000") && Number.isFinite(t) && new Date(t).toISOString().slice(0,10)===s;});
const ciclo=z.discriminatedUnion("origem",[
  z.object({origem:z.literal("calendario"),chave:z.string().regex(/^(0|[1-9]\d*)$/).refine((s)=>Number.isSafeInteger(Number(s))),vencimento:dataCivil,tolerancia_antes:z.number().int().nonnegative(),tolerancia_depois:z.number().int().nonnegative(),semana_origem:z.null(),estado_visita:z.null(),feriado:z.literal("indeterminado"),vigencia_declarada:z.null(),ocorrencia_preparada:z.null(),fonte_incompleta:z.literal(true)}).strict(),
  z.object({origem:z.literal("visita"),chave:z.string().uuid(),vencimento:dataCivil,tolerancia_antes:z.null(),tolerancia_depois:z.null(),semana_origem:dataCivil,estado_visita:z.string().min(1),feriado:z.enum(["declarado","indeterminado"]),vigencia_declarada:z.boolean(),ocorrencia_preparada:z.boolean(),fonte_incompleta:z.literal(true)}).strict(),
]);
type Props={ userId: string; clienteId: string; planoId: string; versaoId: string; rotinaId: string; serieId?: string; revisaoPlano?: number };
export function CiclosUniformes(props:Props) {
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.planoId,props.versaoId,props.rotinaId,props.serieId??null])} {...props}/>;
}
function Conteudo({ userId, clienteId, planoId, versaoId, rotinaId, serieId, revisaoPlano }:Props) {
  const mediada=import.meta.env.VITE_SSO_CICLOS_UNIFORMES_MEDIADOS_ENABLED==="true";
  const [inicio, setInicio] = useState(""); const [fim, setFim] = useState(""); const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const consulta = useInfiniteQuery({ queryKey: ["ciclos-uniformes", userId, clienteId, planoId, versaoId, rotinaId, serieId ?? null, periodo, mediada], enabled: !!periodo, gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { if (!periodo) throw new Error("Período ausente.");
      const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");
      const parametros={p_plano_id:planoId,p_versao_id:versaoId,p_rotina_id:rotinaId,p_serie_id:serieId??null,p_inicio:periodo.inicio,p_fim:periodo.fim,p_apos:pageParam,p_limite:20};
      const requisicao=mediada
        ? supabase.schema("pcm").rpc("sso_consultar_ciclos_uniformes_mediada",{...parametros,p_ator_esperado:userId,p_cliente_id:clienteId})
        : supabase.schema("pcm").rpc("sso_consultar_ciclos_uniformes",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const pagina=z.array(ciclo).max(20).parse(data);let anterior=pageParam;
      for(const item of pagina){
        if(item.origem!==(serieId?"visita":"calendario") || item.vencimento<periodo.inicio || item.vencimento>periodo.fim)throw new Error("Ciclo fora do contexto.");
        if(anterior!==null && (item.origem==="calendario" ? Number(item.chave)<=Number(anterior) : item.chave.toLowerCase()<=anterior.toLowerCase()))throw new Error("Paginação divergente.");
        anterior=item.chave;
      }
      const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");return pagina; },
    getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.chave : undefined });
  return <section aria-label="Consulta uniforme de ciclos"><h4>Consulta de ciclos por {serieId ? "Visita" : "calendário"}</h4>
    <p>Prévia de fonte incompleta, não é cronograma operacional. Visitas concluídas ou canceladas não aparecem; feriado indeterminado não significa dia útil. A consulta não cria ocorrência nem OS.</p>
    {!serieId && revisaoPlano !== undefined && import.meta.env.VITE_SSO_MATERIALIZAR_CICLO_CANONICO_ENABLED === "true" && <p>A preparação de cada ciclo é uma ação separada e exige confirmação. A fonte não informa se já existe ocorrência; vencidos continuam bloqueados e devem ser tratados pelo PCM.</p>}
    <form onSubmit={(e) => { e.preventDefault(); if (inicio && fim && fim >= inicio) setPeriodo({ inicio, fim }); }}><label>De <input type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>{" "}
      <label>Até <input type="date" required value={fim} onChange={(e) => setFim(e.target.value)} /></label><button type="submit">Consultar</button></form>
    {consulta.isFetching && <p>Consultando…</p>}{consulta.isError && <p role="alert">Consulta indisponível ou período inválido. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && !consulta.isError && !consulta.isFetching && <ul>{consulta.data.pages.flat().map((c) => <li key={`${c.origem}:${c.chave}`}>{c.origem} · chave {c.chave} · vencimento {c.vencimento} · feriado {c.feriado}{c.origem === "calendario" ? ` · tolerância ${c.tolerancia_antes}/${c.tolerancia_depois} dias` : ` · semana ${c.semana_origem} · Visita ${c.estado_visita} · vigência ${c.vigencia_declarada ? "declarada" : "não declarada"} · ocorrência preparada ${c.ocorrencia_preparada ? "sim" : "não"}`}
      {c.origem === "calendario" && revisaoPlano !== undefined && import.meta.env.VITE_SSO_MATERIALIZAR_CICLO_CANONICO_ENABLED === "true" && <MaterializarCicloCanonico userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} revision={revisaoPlano} ciclo={Number(c.chave)} vencimento={c.vencimento} />}
    </li>)}</ul>}
    {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais ciclos</button>}
    {!serieId && import.meta.env.VITE_SSO_ESCOPO_PREVENTIVO_ENABLED === "true" && <DeclaracaoEscopoPreventivo userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} />}
  </section>;
}
