import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ResumoDecisaoPcm } from "./ResumoDecisaoPcm";

const item = z.object({ id: z.string().uuid(), cliente_id: z.string().uuid(), cliente_nome: z.string(),
  os_id: z.string().uuid(), os_numero: z.string(), status: z.string(), versao: z.number().int().positive(),
  criada_em: z.string(), tem_oportunidade: z.boolean() }).strict();
type Props = { usuario: string; inicio: string; fim: string };
export function PainelGlobalOperacional(props: Props) {
  if (import.meta.env.VITE_SSO_PAINEL_ORCAMENTOS_OPERACIONAIS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.inicio, props.fim])} {...props} />;
}
function Conteudo({ usuario, inicio, fim }: Props) {
  const consulta = useInfiniteQuery({ queryKey: ["comercial-painel-operacional", usuario, inicio, fim], gcTime: 0,
    retry: false, staleTime: 0, refetchOnWindowFocus: true, initialPageParam: null as string | null,
    enabled: !!inicio && !!fim && inicio <= fim,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("comercial").rpc("sso_painel_propostas_operacionais", {
        p_inicio: inicio, p_fim: fim, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(item).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  return <section className="rounded-lg border border-line bg-card p-4" aria-label="Propostas operacionais">
    <h2 className="font-semibold">Propostas operacionais</h2>
    <p>Somente Contas autorizadas. Período considera data de criação em São Paulo; custos não são apresentados.</p>
    {(!inicio || !fim || inicio > fim) && <p role="alert">Selecione um período válido.</p>}
    {consulta.isFetching && <p>Consultando propostas…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível, sem acesso ou período superior a 730 dias. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && <p>Nenhuma proposta operacional autorizada no período.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <ul>{consulta.data.pages.flat().map((p) => <li key={p.id}>
      {p.cliente_nome} · OS {p.os_numero} · {p.status === "aceita" ? "aprovada" : p.status} · versão {p.versao}
      {p.tem_oportunidade ? " · vinculada a oportunidade" : " · origem operacional"}
      {import.meta.env.VITE_SSO_DECISAO_PCM_ORCAMENTO_ENABLED === "true" && <ResumoDecisaoPcm usuario={usuario} cliente={p.cliente_id} os={p.os_id} proposta={p.id} versao={p.versao} />}
    </li>)}</ul>}
    {!consulta.isError && consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais propostas</button>}
  </section>;
}
