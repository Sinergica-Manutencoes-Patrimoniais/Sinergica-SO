import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { DiagnosticoDocumentos } from "./DiagnosticoDocumentos";
import { ConferirDatasDocumentos } from "./ConferirDatasDocumentos";
import { RelatorioAlocacaoPagamento } from "./RelatorioAlocacaoPagamento";

const item = z.object({ alocacao_id: z.string().guid(), documento_id: z.string().guid(), referencia: z.string(), data_documento: z.string(),
  item_id: z.string().guid(), valor_centavos: z.string().regex(/^\d+$/), estornada: z.boolean() }).strict();
export function DocumentosCompetencia({ usuario, cliente }: { usuario: string; cliente: string }) {
  const hoje = new Date(); const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [mes, setMes] = useState(atual); const [competencia, setCompetencia] = useState(atual);
  const lista = useInfiniteQuery({ queryKey: ["documentos-competencia", usuario, cliente, competencia], gcTime: 0, staleTime: 0,
    enabled: import.meta.env.VITE_SSO_DOCUMENTOS_COMPETENCIA_ENABLED === "true", retry: false, refetchOnWindowFocus: true, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("financeiro").rpc("sso_documentos_competencia", {
        p_cliente_id: cliente, p_competencia: `${competencia}-01`, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(20).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.alocacao_id : undefined });
  if (import.meta.env.VITE_SSO_DOCUMENTOS_COMPETENCIA_ENABLED !== "true") return null;
  return <section aria-label="Documentos e alocações por competência"><h3>Documentos e alocações</h3>
    <form onSubmit={(e) => { e.preventDefault(); if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) setCompetencia(mes); }}>
      <label>Competência do item <input type="month" required value={mes} onChange={(e) => setMes(e.target.value)} /></label>
      <button type="submit">Consultar</button>
    </form>
    <p>Mostra associações existentes na competência do item. Estorno lógico não comprova reconciliação ou pagamento.</p>
    {import.meta.env.VITE_SSO_DATAS_DOCUMENTOS_ENABLED === "true" && <ConferirDatasDocumentos usuario={usuario} cliente={cliente} competencia={competencia} />}
    {import.meta.env.VITE_SSO_RELATORIO_ALOCACAO_PAGAMENTO_ENABLED === "true" && <RelatorioAlocacaoPagamento usuario={usuario} cliente={cliente} competencia={competencia} />}
    {import.meta.env.VITE_SSO_DIAGNOSTICO_DOCUMENTOS_ENABLED === "true" && <DiagnosticoDocumentos key={competencia} usuario={usuario} cliente={cliente} competencia={competencia} />}
    {lista.isFetching && <p>Consultando documentos…</p>}
    {lista.isError && <p role="alert">Consulta indisponível ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma alocação nesta competência.</p>}
    {!lista.isFetching && !lista.isError && lista.data?.pages.flat().map((a) => <article key={a.alocacao_id}>
      <p>Documento {a.referencia} · data {a.data_documento} · item {a.item_id}</p>
      <p>{a.valor_centavos} centavos · {a.estornada ? "estorno lógico registrado" : "alocação ativa"}</p>
    </article>)}
    {!lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais alocações</button>}
  </section>;
}
