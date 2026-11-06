import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const inteiro = z.number().int().nonnegative().safe();
const linha = z.object({ tecnico_id: z.string().uuid().nullable(), tecnico_nome: z.string().nullable(), quantidade: inteiro,
  previsto_centavos: inteiro, realizado_centavos: inteiro, sem_realizado: inteiro, atribuicoes_historicas: inteiro }).strict();
const moeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);
type Props = { userId: string; clienteId: string; periodoInicial?: { inicio: string; fim: string } };
export function RelatorioClienteDespesas(props: Props) {
  if (import.meta.env.VITE_SSO_RELATORIO_DESPESAS_CLIENTE_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.periodoInicial])} {...props} />;
}
function Conteudo({ userId, clienteId, periodoInicial }: Props) {
  const [inicio, setInicio] = useState(periodoInicial?.inicio ?? ""); const [fim, setFim] = useState(periodoInicial?.fim ?? "");
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(periodoInicial ?? null);
  const consulta = useQuery({ queryKey: ["relatorio-despesas-cliente", userId, clienteId, periodo], enabled: !!periodo,
    gcTime: 0, retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      if (!periodo) throw new Error("Período ausente.");
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const parametros={p_cliente_id:clienteId,p_inicio:periodo.inicio,p_fim:periodo.fim};
      const requisicao=import.meta.env.VITE_SSO_RELATORIO_DESPESAS_CLIENTE_MEDIADO_ENABLED==="true"
        ? supabase.schema("pcm").rpc("sso_relatorio_despesas_cliente_mediado",{...parametros,p_ator_id:userId})
        : supabase.schema("pcm").rpc("sso_relatorio_despesas_cliente",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const linhas=z.array(linha).parse(data);
      const identidades=new Set<string>();let previsto=0,realizado=0,quantidade=0,ausentes=0;
      for(const item of linhas){const id=item.tecnico_id?.toLowerCase()??"sem-tecnico";
        if(identidades.has(id)||item.sem_realizado>item.quantidade||item.atribuicoes_historicas>item.quantidade)throw new Error("Relatório divergente.");
        identidades.add(id);previsto+=item.previsto_centavos;realizado+=item.realizado_centavos;quantidade+=item.quantidade;ausentes+=item.sem_realizado;
        if(![previsto,realizado,quantidade,ausentes].every(Number.isSafeInteger))throw new Error("Total excede precisão permitida.");}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return linhas;
    } });
  const linhas = consulta.data ?? [];
  const totalPrevisto = linhas.reduce((s, x) => s + x.previsto_centavos, 0);
  const totalRealizado = linhas.reduce((s, x) => s + x.realizado_centavos, 0);
  const qtd = linhas.reduce((s, x) => s + x.quantidade, 0);
  const semRealizado = linhas.reduce((s, x) => s + x.sem_realizado, 0);
  return <section aria-label="Relatório interno de despesas do Cliente"><h4>Despesas internas do Cliente por período</h4>
    <p>Uso interno: estes valores não fazem parte do relatório público, PDF ou publicação no Portal.</p>
    <p>Data corresponde à despesa. Valor realizado ausente não é zero; despesa sem técnico fica separada.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (inicio && fim && inicio <= fim) {if(periodo?.inicio===inicio&&periodo.fim===fim)void consulta.refetch();else setPeriodo({ inicio, fim });} }}>
      <label>De <input type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
      <label>Até <input type="date" required value={fim} onChange={(e) => setFim(e.target.value)} /></label>
      <button type="submit">Consultar período</button>
    </form>
    {consulta.isFetching && <p>Consultando relatório…</p>}
    {consulta.isError && <p role="alert">Relatório indisponível ou período inválido (limite de 730 dias). <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {periodo && (inicio!==periodo.inicio||fim!==periodo.fim) && <p role="status">Período alterado; consulte novamente para atualizar os valores.</p>}
    {!!periodo && inicio===periodo.inicio && fim===periodo.fim && !consulta.isFetching && !consulta.isError && consulta.data && <div>
      <p>Período consultado: {periodo.inicio} a {periodo.fim}.</p>
      <p>Total: {qtd} despesa(s) · previsto {moeda(totalPrevisto)} · {qtd > 0 && semRealizado === qtd ? "nenhum realizado informado" : `realizado informado ${moeda(totalRealizado)}`} · {semRealizado} sem realizado.</p>
      {linhas.length === 0 && <p>Nenhuma despesa no período.</p>}
      {linhas.map((x) => <p key={x.tecnico_id ?? "sem-atribuicao"}>{x.tecnico_nome ?? "Sem técnico atribuído"} · {x.quantidade} despesa(s) · previsto {moeda(x.previsto_centavos)} · {x.sem_realizado === x.quantidade ? "realizado não informado" : `realizado informado ${moeda(x.realizado_centavos)}`} · {x.sem_realizado} sem realizado{x.atribuicoes_historicas ? ` · ${x.atribuicoes_historicas} atribuição(ões) em vínculo encerrado` : ""}</p>)}
    </div>}
  </section>;
}
