import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const aquisicao = z.object({ fonteId: uuid, tipo: z.enum(["material", "retirada_exclusiva"]), listaRevision: z.number().int().positive(),
  valorCentavos: z.number().int().safe().nonnegative() }).strict();
const parcela = z.object({ despesaId: uuid, despesaRevision: z.number().int().positive(), rateioRevision: z.number().int().positive(),
  vinculoId: uuid, grupo: z.literal("operacional"), valorCentavos: z.number().int().safe().nonnegative(),
  base: z.enum(["previsto", "realizado"]), descricaoFonte: z.string().min(1).max(10000) }).strict();
const linha = z.object({ request_id: uuid, fontes_operacionais: z.array(parcela).max(100), fontes_aquisicao: z.array(aquisicao).max(100),
  criado_em: z.string().datetime({ offset: true }) }).strict();

export function HistoricoComposicaoMista({ usuario, cliente, propostaId, versao }: { usuario: string; cliente: string; propostaId: string; versao: number }) {
  const consulta = useInfiniteQuery({ queryKey: ["orcamento-fontes-mistas-historico", usuario, cliente, propostaId, versao],
    initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("comercial").rpc("sso_listar_fontes_composicao_mista", {
        p_ator_id: usuario, p_cliente_id: cliente, p_proposta_id: propostaId, p_versao: versao, p_apos: pageParam, p_limite: 30,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(30).parse(data); let anterior = pageParam ?? "";
      for (const r of pagina) { if (r.request_id <= anterior) throw new Error("Página divergente"); anterior = r.request_id; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada");
      return pagina;
    }, getNextPageParam: (p) => p.length === 30 ? p.at(-1)?.request_id : undefined });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Histórico de fontes da composição mista">
    <h4>Fontes registradas nesta versão</h4><p>Uso registrado não comprova que gastos físicos diferentes tenham origens distintas.</p>
    {consulta.isFetching && <p role="status">Consultando fontes…</p>}
    {consulta.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0 ? <p>Nenhuma composição mista encontrada nesta versão.</p> :
      <ul>{itens.map((r) => <li key={r.request_id}>Registrado em {r.criado_em}
        <ul>{r.fontes_aquisicao.map((a) => <li key={a.fonteId}>{a.tipo === "material" ? "Material" : "Retirada exclusiva"} · fonte {a.fonteId} · {a.valorCentavos} centavos · revisão da lista {a.listaRevision}</li>)}
          {r.fontes_operacionais.map((p) => <li key={`${p.despesaId}:${p.vinculoId}`}>{p.descricaoFonte} · {p.valorCentavos} centavos · {p.base} · despesa {p.despesaId} · rateio {p.rateioRevision}</li>)}</ul>
      </li>)}</ul>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais registros</button>}
  </section>;
}
