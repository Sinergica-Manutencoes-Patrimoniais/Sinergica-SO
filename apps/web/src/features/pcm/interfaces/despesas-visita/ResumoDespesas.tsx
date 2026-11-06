import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { RelatorioOsDespesas } from "./RelatorioOsDespesas";

const inteiro = z.number().int().nonnegative().safe();
const resumo = z.object({ quantidade: inteiro, previsto_centavos: inteiro, realizado_centavos: inteiro,
  sem_realizado: inteiro, sem_rateio: inteiro, rateio_historico: inteiro }).strict();
const os = z.object({ os_id: z.string().uuid(), numero: z.string(), valor_previsto_nao_realizado_centavos: inteiro,
  valor_realizado_centavos: inteiro, despesas_nao_realizadas: inteiro, vinculos_historicos: inteiro }).strict();
type Props = { userId: string; clienteId: string; visitaId: string };
const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);
export function ResumoDespesas(props: Props) {
  if (import.meta.env.VITE_SSO_RESUMO_DESPESAS_VISITA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId])} {...props} />;
}
function Conteudo({ userId, clienteId, visitaId }: Props) {
  const [osAberta, setOsAberta] = useState<string | null>(null);
  const total = useQuery({ queryKey: ["despesas-visita", userId, clienteId, visitaId, "resumo"], gcTime: 0, retry: false,
    refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_resumo_despesas_visita", { p_cliente_id: clienteId, p_visita_id: visitaId }).abortSignal(signal);
      if (error) throw error;const resultado=z.array(resumo).length(1).parse(data)[0];const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return resultado; } });
  const porOs = useInfiniteQuery({ queryKey: ["despesas-visita", userId, clienteId, visitaId, "resumo-os"], gcTime: 0, retry: false,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_resumo_despesas_os_visita", {
        p_cliente_id: clienteId, p_visita_id: visitaId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error;const pagina=z.array(os).max(20).parse(data);let anterior=pageParam?.toLowerCase()??"";
      for(const item of pagina){const atual=item.os_id.toLowerCase();if(atual<=anterior)throw new Error("Página divergente.");anterior=atual;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.os_id : undefined });
  const r = total.data;
  return <section aria-label="Resumo de despesas"><h4>Resumo de despesas</h4>
    {(total.isFetching || porOs.isFetching) && <p>Consultando totais…</p>}
    {(total.isError || porOs.isError) && <p role="alert">Resumo indisponível ou sem acesso. <button type="button" onClick={() => { void total.refetch(); void porOs.refetch(); }}>Tentar novamente</button></p>}
    <p>Totais da Visita e parcelas por OS são consultas independentes; mudanças concorrentes podem deixar as duas visões temporariamente diferentes.</p>
    {!total.isFetching && !total.isError && r && <div>
      <p>Despesas ativas: {r.quantidade} · Previsão: {moeda(r.previsto_centavos)}</p>
      <p>{r.quantidade > 0 && r.sem_realizado === r.quantidade ? "Nenhum valor realizado informado" : `Realizado informado: ${moeda(r.realizado_centavos)}`} · {r.sem_realizado} despesa(s) sem valor realizado</p>
      <p>{r.sem_rateio} despesa(s) sem rateio; esses valores permanecem apenas no total da Visita.</p>
      {r.rateio_historico > 0 && <p role="alert">{r.rateio_historico} despesa(s) têm rateios ligados a vínculos encerrados; confira antes de usar os totais por OS.</p>}
    </div>}
    {!porOs.isFetching && !porOs.isError && <div><h5>Parcelas por OS</h5>
      {porOs.data?.pages.flat().length === 0 && <p>Nenhuma parcela atribuída a OS.</p>}
      {porOs.data?.pages.flat().map((item) => <section key={item.os_id} aria-label={`Despesas da OS ${item.numero}`}>
        <p>OS {item.numero} · Previsão de despesas ainda não realizadas: {moeda(item.valor_previsto_nao_realizado_centavos)} · Realizado alocado: {moeda(item.valor_realizado_centavos)} · {item.despesas_nao_realizadas} despesa(s) sem realizado
          {item.vinculos_historicos > 0 ? ` · ${item.vinculos_historicos} vínculo(s) encerrado(s): total inclui parcelas históricas` : ""}</p>
        {import.meta.env.VITE_SSO_RELATORIO_DESPESAS_OS_ENABLED === "true" && <button type="button" aria-expanded={osAberta === item.os_id}
          onClick={() => setOsAberta((atual) => atual === item.os_id ? null : item.os_id)}>
          {osAberta === item.os_id ? "Fechar relatório da OS" : "Consultar relatório da OS por período"}
        </button>}
        {osAberta === item.os_id && <RelatorioOsDespesas userId={userId} clienteId={clienteId} osId={item.os_id} />}
      </section>)}
      {porOs.hasNextPage && <button type="button" onClick={() => void porOs.fetchNextPage()}>Mais OS</button>}
    </div>}
  </section>;
}
