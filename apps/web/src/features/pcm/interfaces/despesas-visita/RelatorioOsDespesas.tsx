import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const inteiro = z.number().int().nonnegative().safe();
const linha = z.object({ despesas: inteiro, previsto_nao_realizado_centavos: inteiro, realizado_centavos: inteiro,
  sem_realizado: inteiro, vinculos_historicos: inteiro }).strict();
const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);
type Props = { userId: string; clienteId: string; osId: string };
export function RelatorioOsDespesas(props: Props) {
  if (import.meta.env.VITE_SSO_RELATORIO_DESPESAS_OS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId }: Props) {
  const [inicio, setInicio] = useState(""); const [fim, setFim] = useState("");
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const consulta = useQuery({ queryKey: ["relatorio-despesas-os", userId, clienteId, osId, periodo], enabled: !!periodo,
    gcTime: 0, retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      if (!periodo) throw new Error("Período ausente.");
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const parametros={p_cliente_id:clienteId,p_os_id:osId,p_inicio:periodo.inicio,p_fim:periodo.fim};
      const requisicao=import.meta.env.VITE_SSO_RELATORIO_DESPESAS_OS_MEDIADO_ENABLED==="true"
        ? supabase.schema("pcm").rpc("sso_relatorio_despesas_os_mediado",{...parametros,p_ator_id:userId})
        : supabase.schema("pcm").rpc("sso_relatorio_despesas_os",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const resultado=z.array(linha).length(1).parse(data)[0];
      if (!resultado || resultado.sem_realizado > resultado.despesas) throw new Error("Relatório divergente.");
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return resultado;
    } });
  return <section aria-label="Despesas internas rateadas da OS"><h4>Despesas internas rateadas da OS</h4>
    <p>Somente parcelas atribuídas a esta OS; despesas sem rateio não são incluídas. Não publicadas ao Cliente. Leituras concorrentes podem alterar totais e contagens; o relatório não é fotografia transacional.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (inicio && fim && inicio <= fim) {if(periodo?.inicio===inicio&&periodo.fim===fim)void consulta.refetch();else setPeriodo({ inicio, fim });} }}>
      <label>De <input type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
      <label>Até <input type="date" required value={fim} onChange={(e) => setFim(e.target.value)} /></label>
      <button type="submit">Consultar</button>
    </form>
    {consulta.isFetching && <p>Consultando parcelas…</p>}
    {consulta.isError && <p role="alert">Dados indisponíveis ou período inválido (limite de 730 dias). <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {periodo && (inicio!==periodo.inicio||fim!==periodo.fim) && <p role="status">Período alterado; consulte novamente para atualizar os valores.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && periodo && inicio===periodo.inicio && fim===periodo.fim && <div>
      <p>Período consultado: {periodo.inicio} a {periodo.fim}.</p>
      <p>{consulta.data.despesas} despesa(s) · previsão das não realizadas {moeda(consulta.data.previsto_nao_realizado_centavos)} · {consulta.data.despesas > 0 && consulta.data.sem_realizado === consulta.data.despesas ? "realizado não informado" : `realizado alocado ${moeda(consulta.data.realizado_centavos)}`} · {consulta.data.sem_realizado} sem valor realizado.</p>
      {consulta.data.vinculos_historicos > 0 && <p role="alert">Inclui {consulta.data.vinculos_historicos} vínculo(s) encerrado(s); confira o rateio histórico.</p>}
    </div>}
  </section>;
}
