import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { HistoricoCustosProposta } from "./HistoricoCustosProposta";
import { EditarComposicaoEscopada } from "./EditarComposicaoEscopada";

const valor = z.number().int().nonnegative().safe();
const resposta = z.object({ clienteId: z.string().guid(), propostaId: z.string().guid(), versao: z.number().int().positive(), atualizadaEm: z.string().datetime({ offset: true }), custoTotalCentavos: valor, pisoCentavos: valor, precoSugeridoCentavos: valor, precoCentavos: valor }).strict();
const item = z.object({ id: z.string().guid(), tipo: z.enum(["mo", "material", "veiculo", "outro"]), descricao: z.string(), quantidade: z.number().nonnegative().finite(), custo_unitario_centavos: valor, total_centavos: valor }).strict();
const dinheiro = (centavos: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

export function CustosProposta({ userId, clienteId, propostaId }: { userId: string; clienteId: string; propostaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [itensAbertos, setItensAbertos] = useState(false);
  const consulta = useQuery({ queryKey: ["custos-proposta-escopados", userId, clienteId, propostaId], enabled: aberto, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_custos_proposta", { p_cliente_id: clienteId, p_proposta_id: propostaId }).abortSignal(signal);
      if (error) throw error; const r = resposta.parse(data);
      if (r.clienteId.toLowerCase() !== clienteId.toLowerCase() || r.propostaId.toLowerCase() !== propostaId.toLowerCase()) throw new Error("Proposta divergente.");
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return r;
    } });
  const itens = useInfiniteQuery({ queryKey: ["custos-proposta-itens", userId, clienteId, propostaId], enabled: aberto && itensAbertos && consulta.isSuccess && !consulta.isFetching && !consulta.isError, gcTime: 0, staleTime: 0, retry: false, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_itens_custo_proposta", { p_cliente_id: clienteId, p_proposta_id: propostaId, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(item).max(50).parse(data); let anterior = pageParam?.toLowerCase() ?? "";
      for (const linha of pagina) { if (linha.id.toLowerCase() <= anterior) throw new Error("Página divergente."); anterior = linha.id.toLowerCase(); }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.id : undefined });
  const linhas = itens.data?.pages.flat() ?? [];
  const consistentes = linhas.every((linha, indice) => indice === 0 || linhas[indice - 1]!.id.toLowerCase() < linha.id.toLowerCase());
  return <section aria-label="Custos atuais da proposta"><button type="button" aria-expanded={aberto} onClick={() => { setAberto((v) => !v); setItensAbertos(false); }}>{aberto ? "Ocultar custos" : "Consultar custos"}</button>
    {aberto && <>{consulta.isFetching && <output>Consultando custos…</output>}{consulta.isError && <p role="alert">Custos indisponíveis ou acesso não autorizado. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && consulta.data && <><p>Versão atual {consulta.data.versao} · custo {dinheiro(consulta.data.custoTotalCentavos)} · piso {dinheiro(consulta.data.pisoCentavos)} · sugerido {dinheiro(consulta.data.precoSugeridoCentavos)} · venda {dinheiro(consulta.data.precoCentavos)}. Dados atuais, não fotografia histórica.</p>
        {import.meta.env.VITE_SSO_EDITAR_COMPOSICAO_ESCOPADA_ENABLED === "true" && <EditarComposicaoEscopada userId={userId} clienteId={clienteId} propostaId={propostaId} />}
        {import.meta.env.VITE_SSO_HISTORICO_CUSTOS_PROPOSTA_ENABLED === "true" && <HistoricoCustosProposta userId={userId} clienteId={clienteId} propostaId={propostaId} />}
        {import.meta.env.VITE_SSO_ITENS_CUSTO_PROPOSTA_ENABLED === "true" && <><button type="button" aria-expanded={itensAbertos} onClick={() => setItensAbertos((v) => !v)}>{itensAbertos ? "Ocultar composição" : "Consultar composição"}</button>
          {itensAbertos && <><p>Itens atuais; páginas podem mudar durante a consulta.</p>{itens.isFetching && <output>Consultando itens…</output>}{(itens.isError || !consistentes) && <p role="alert">Composição indisponível ou divergente. <button type="button" onClick={() => void itens.refetch()}>Tentar novamente</button></p>}
            {!itens.isFetching && !itens.isError && consistentes && itens.data && <><ul>{linhas.map((linha) => <li key={linha.id}>{linha.tipo} · {linha.descricao} · quantidade {linha.quantidade} · unitário {dinheiro(linha.custo_unitario_centavos)} · total {dinheiro(linha.total_centavos)}</li>)}</ul>{linhas.length === 0 && <p>Nenhum item na composição atual.</p>}</>}
            {itens.hasNextPage && !itens.isError && consistentes && <button type="button" disabled={itens.isFetching} onClick={() => void itens.fetchNextPage()}>Mais itens</button>}</>}</>}
      </>}</>}
  </section>;
}
