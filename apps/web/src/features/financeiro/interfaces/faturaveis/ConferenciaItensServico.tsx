import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const contagem = z.union([z.number(), z.string().regex(/^\d+$/)])
  .refine((v) => Number.isSafeInteger(Number(v)) && Number(v) >= 0).transform(Number);
const resultado = z.object({ clienteId: uuid, fatoId: uuid, declaracoesMaterial: contagem, itensPropostaIntegral: contagem,
  itensMaterialMesmaLinha: contagem, itensCancelados: contagem, itensNaoCancelados: contagem,
  exclusividadeComprovada: z.literal(false), geraFaturavel: z.literal(false) }).strict();

export function ConferenciaItensServico(props: { usuario: string; cliente: string; declaracao: string }) {
  if (import.meta.env.VITE_SSO_CONFERENCIA_ITENS_SERVICO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.declaracao])} {...props} />;
}
function Conteudo({ usuario, cliente, declaracao }: { usuario: string; cliente: string; declaracao: string }) {
  const consulta = useQuery({ queryKey: ["conferencia-itens-servico", usuario, cliente, declaracao], enabled: false, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      async function sessao() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada."); }
      await sessao();
      const fatos = await supabase.schema("financeiro").rpc("sso_consultar_fato_execucao_mediado", { p_cliente_id: cliente, p_declaracao_id: declaracao }).abortSignal(signal);
      if (fatos.error) throw fatos.error;
      const lista = z.array(z.object({ fato_id: uuid }).strict()).max(1).parse(fatos.data);
      await sessao(); if (!lista.length) return null;
      const r = await supabase.schema("financeiro").rpc("sso_conferir_itens_linha_servico", { p_cliente_id: cliente, p_fato_id: lista[0]!.fato_id }).abortSignal(signal);
      if (r.error) throw r.error;
      const dados = resultado.parse(r.data);
      if (dados.clienteId !== cliente || dados.fatoId !== lista[0]!.fato_id || dados.itensCancelados + dados.itensNaoCancelados !== dados.itensPropostaIntegral + dados.itensMaterialMesmaLinha) throw new Error("Resultado divergente.");
      await sessao(); return dados;
    } });
  const fato = !consulta.isFetching && !consulta.isError ? consulta.data?.fatoId : undefined;
  const classificacao = useQuery({ queryKey: ["classificacao-fato-servico", usuario, cliente, declaracao, fato], enabled: false, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      if (!fato) throw new Error("Fato não conferido.");
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("financeiro").rpc("sso_classificacao_fato_servico", { p_cliente_id: cliente, p_fato_id: fato }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ clienteId: uuid, fatoId: uuid, propostaId: uuid, versao: z.number().int().positive(), linhaId: uuid,
        tipo: z.enum(["servico", "material"]).nullable(), decisao: z.enum(["aceita", "rejeitada"]).nullable(), propostaAtual: z.boolean(),
        execucaoFisicaComprovada: z.literal(false), exclusividadeComprovada: z.literal(false), geraFaturavel: z.literal(false) }).strict().parse(data);
      if (r.clienteId !== cliente || r.fatoId !== fato || (!r.tipo && r.decisao)) throw new Error("Classificação divergente.");
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      return r;
    } });
  return <section aria-label="Conferência financeira da linha"><h5>Itens financeiros relacionados</h5>
    <p>Consulta pontual de proposta integral e materiais da mesma linha. Não cobre todas as origens, valores ou estornos e não comprova exclusividade.</p>
    <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.refetch()}>Consultar itens relacionados</button>
    {consulta.isFetching && <output>Consultando…</output>}
    {consulta.isError && <p role="alert">Consulta indisponível ou sem permissão.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data === null && <p>Identidade interna ainda não encontrada.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <p>Declarações de material na linha: {consulta.data.declaracoesMaterial}; itens de proposta integral: {consulta.data.itensPropostaIntegral}; itens de material na linha: {consulta.data.itensMaterialMesmaLinha}; não cancelados: {consulta.data.itensNaoCancelados}; cancelados: {consulta.data.itensCancelados}. Contagens incluem itens base e complementos.</p>}
    {import.meta.env.VITE_SSO_CLASSIFICACAO_FATO_SERVICO_ENABLED === "true" && fato && <section aria-label="Classificação comercial da linha">
      <button type="button" disabled={classificacao.isFetching} onClick={() => void classificacao.refetch()}>Consultar classificação da linha</button>
      {classificacao.isFetching && <output>Consultando classificação…</output>}
      {classificacao.isError && <p role="alert">Classificação indisponível ou sem permissão.</p>}
      {!classificacao.isFetching && !classificacao.isError && classificacao.data && <p>Tipo declarado: {classificacao.data.tipo ?? "não informado"}; revisão: {classificacao.data.decisao ?? "não realizada"}; proposta na versão aceita: {classificacao.data.propostaAtual ? "sim" : "não"}. Essa decisão interna não comprova execução física ou exclusividade.</p>}
    </section>}
  </section>;
}
