import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ alocacao_id: z.string().uuid(), documento_ref: z.string(), data_documento: z.string(),
  valor_centavos: z.number().int().positive().safe(), lancamento_id: z.string().uuid(),
  lancamento_status: z.enum(["previsto", "realizado"]), data_pagamento: z.string().nullable(),
  estorno_id: z.string().uuid().nullable(), conferencia_id: z.string().uuid().nullable(), data_conferencia: z.string().nullable() }).strict();
type Props = { usuario: string; cliente: string; itemId: string };
export function HistoricoDocumentos(props: Props) {
  if (import.meta.env.VITE_SSO_HISTORICO_FATURAVEL_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.itemId])} {...props} />;
}
function Conteudo({ usuario, cliente, itemId }: Props) {
  const consulta = useInfiniteQuery({ queryKey: ["historico-faturavel", usuario, cliente, itemId], gcTime: 0,
    staleTime: 0, retry: false, refetchOnWindowFocus: true, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("financeiro").rpc("sso_historico_documentos_faturavel", {
        p_item_id: itemId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(linha).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.alocacao_id : undefined });
  return <section aria-label="Histórico financeiro do item"><h5>Documentos e alocações</h5>
    {consulta.isFetching && <p>Consultando histórico…</p>}
    {consulta.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && <p>Nenhuma alocação.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().map((a) => <p key={a.alocacao_id}>
      Documento {a.documento_ref} · {a.data_documento} · {a.valor_centavos} centavos · lançamento {a.lancamento_status}
      {a.data_pagamento ? ` em ${a.data_pagamento}` : ""} · {a.estorno_id ? a.conferencia_id ? "estorno lógico com conferência declarada" : "estorno lógico sem conferência" : "alocação ativa"}
    </p>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais documentos</button>}
    <p>Conferência declarada não comprova estorno financeiro ou contábil.</p>
  </section>;
}
