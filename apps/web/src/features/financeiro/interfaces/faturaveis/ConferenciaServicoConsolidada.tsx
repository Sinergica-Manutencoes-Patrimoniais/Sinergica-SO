import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const count = z.union([z.number(), z.string().regex(/^\d+$/)]).refine(v => Number.isSafeInteger(Number(v)) && Number(v) >= 0).transform(Number);
const comum = { clienteId: uuid, fatoId: uuid, exclusividadeComprovada: z.literal(false), geraFaturavel: z.literal(false) };
const atestacao = z.object({ ...comum, revision: z.number().int().nonnegative().safe(), estado: z.enum(["confirmada", "retirada"]).nullable(),
  revisaoPcmId: uuid, revisaoPcmAtual: z.boolean(), execucaoFisicaComprovada: z.literal(false) }).strict();
const classificacao = z.object({ ...comum, propostaId: uuid, versao: z.number().int().positive(), linhaId: uuid, tipo: z.enum(["servico", "material"]).nullable(),
  decisao: z.enum(["aceita", "rejeitada"]).nullable(), propostaAtual: z.boolean(), execucaoFisicaComprovada: z.literal(false) }).strict();
const itens = z.object({ ...comum, declaracoesMaterial: count, itensPropostaIntegral: count, itensMaterialMesmaLinha: count,
  itensCancelados: count, itensNaoCancelados: count }).strict();

export function ConferenciaServicoConsolidada(props: { usuario: string; cliente: string; declaracao: string }) {
  if (import.meta.env.VITE_SSO_CONFERENCIA_SERVICO_CONSOLIDADA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.declaracao])} {...props}/>;
}
function Conteudo({ usuario, cliente, declaracao }: { usuario: string; cliente: string; declaracao: string }) {
  const consulta = useQuery({ queryKey: ["conferencia-servico-consolidada", usuario, cliente, declaracao], enabled: false, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      async function sessao() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada."); }
      await sessao();
      const origem = await supabase.schema("financeiro").rpc("sso_consultar_fato_execucao_mediado", { p_cliente_id: cliente, p_declaracao_id: declaracao }).abortSignal(signal);
      if (origem.error) throw origem.error;
      const fatos = z.array(z.object({ fato_id: uuid }).strict()).max(1).parse(origem.data);
      await sessao(); if (!fatos.length) return null;
      const fato = fatos[0]!.fato_id;
      const [a, c, i] = await Promise.all([
        supabase.schema("financeiro").rpc("sso_consultar_atestacao_servico", { p_cliente_id: cliente, p_fato_id: fato }).abortSignal(signal),
        supabase.schema("financeiro").rpc("sso_classificacao_fato_servico", { p_cliente_id: cliente, p_fato_id: fato }).abortSignal(signal),
        supabase.schema("financeiro").rpc("sso_conferir_itens_linha_servico", { p_cliente_id: cliente, p_fato_id: fato }).abortSignal(signal),
      ]);
      if (a.error || c.error || i.error) throw new Error("Fonte indisponível.");
      const A = atestacao.parse(a.data); const C = classificacao.parse(c.data); const I = itens.parse(i.data);
      if ([A, C, I].some(v => v.clienteId !== cliente || v.fatoId !== fato) ||
        I.itensCancelados + I.itensNaoCancelados !== I.itensPropostaIntegral + I.itensMaterialMesmaLinha || (!C.tipo && C.decisao)) throw new Error("Fontes divergentes.");
      await sessao(); return { atestacao: A, classificacao: C, itens: I };
    } });
  const dados = !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  return <section aria-label="Conferência consolidada de serviço"><h5>Conferência consolidada</h5>
    <p>As fontes são consultadas separadamente: não são uma fotografia transacional. O resultado não reserva valores nem libera faturamento.</p>
    <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.refetch()}>Conferir fontes</button>
    {consulta.isFetching && <output>Consultando fontes…</output>}
    {consulta.isError && <p role="alert">Não foi possível conferir todas as fontes; nenhuma conclusão financeira está disponível.</p>}
    {dados === null && <p>Identidade do fato ainda não registrada.</p>}
    {dados && <ul>
      <li>Atestação PCM: {dados.atestacao.estado ?? "não registrada"}; revisão PCM {dados.atestacao.revisaoPcmAtual ? "atual e aprovada" : "desatualizada ou não aprovada"}.</li>
      <li>Classificação: {dados.classificacao.tipo ?? "não declarada"}; revisão {dados.classificacao.decisao ?? "não realizada"}; proposta {dados.classificacao.propostaAtual ? "na versão aceita" : "não está na versão aceita"}.</li>
      <li>Materiais declarados na linha: {dados.itens.declaracoesMaterial}; itens financeiros de material: {dados.itens.itensMaterialMesmaLinha}; itens de proposta integral: {dados.itens.itensPropostaIntegral}. Inclui cancelados e complementos.</li>
      <li>Execução física e exclusividade financeira não comprovadas; não foi criado faturável.</li>
    </ul>}
  </section>;
}
