import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const count = z.number().int().nonnegative();
const resposta = z.object({ competencia: z.string(), alocacoes: count, alocadoBrutoCentavos: z.string(), estornadoCentavos: z.string(), documentos: count, lancamentosRealizadosComData: count, valorIntegralLancamentosRealizadosCentavos: z.string(), situacaoLocalDesconhecida: count, confirmaLiquidacaoBancaria: z.literal(false), medidasSomaveisEntreSi: z.literal(false) }).strict();
export function RelatorioAlocacaoPagamento({ usuario, cliente, competencia }: { usuario: string; cliente: string; competencia: string }) {
  const consulta = useQuery({ queryKey: ["relatorio-alocacao-pagamento", usuario, cliente, competencia], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_relatorio_alocacao_pagamento", { p_cliente_id: cliente, p_competencia: `${competencia}-01` }).abortSignal(signal); if (error) throw error; const r = resposta.parse(data); if (r.competencia !== `${competencia}-01`) throw new Error("Competência divergente"); return r; } });
  return <section aria-label="Alocação e situação local de lançamentos"><h4>Alocação e lançamentos</h4><p>Valores são medidas distintas. Lançamento realizado com data é estado local, não confirmação bancária; seu valor integral pode incluir outras competências ou itens.</p>
    {consulta.isFetching && <output>Consultando relatório…</output>}{consulta.isError && <p role="alert">Relatório indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && <><p>{consulta.data.alocacoes} alocações · bruto {consulta.data.alocadoBrutoCentavos} centavos · estornado {consulta.data.estornadoCentavos} centavos.</p><p>{consulta.data.documentos} documentos · {consulta.data.lancamentosRealizadosComData} lançamentos marcados realizados com data · valor integral {consulta.data.valorIntegralLancamentosRealizadosCentavos} centavos · {consulta.data.situacaoLocalDesconhecida} situações locais desconhecidas.</p></>}
  </section>;
}
