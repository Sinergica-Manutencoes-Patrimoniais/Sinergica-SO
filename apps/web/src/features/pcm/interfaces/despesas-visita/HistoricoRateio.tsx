import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const parcela = z.object({ vinculoId: z.string().uuid(), osId: z.string().uuid().nullable(), valorCentavos: z.string().regex(/^\d{1,19}$/),
  vinculo: z.enum(["ausente", "incompativel", "encerrado", "vigente"]) }).strict();
const registro = z.object({ revisao: z.number().int().positive(), ator_id: z.string().uuid(), criado_em: z.string(), parcelas: z.array(parcela).max(100) }).strict();
export function HistoricoRateio({ userId, clienteId, visitaId, despesaId, revisao }: { userId: string; clienteId: string; visitaId: string; despesaId: string; revisao: number }) {
  const [aberto, setAberto] = useState(false);
  const lista = useInfiniteQuery({ queryKey: ["despesas-visita", userId, clienteId, visitaId, despesaId, "historico-rateio", revisao],
    enabled: aberto, gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const parametros={p_cliente_id:clienteId,p_visita_id:visitaId,p_despesa_id:despesaId,p_apos:pageParam};
      const requisicao=import.meta.env.VITE_SSO_HISTORICO_RATEIO_MEDIADO_ENABLED==="true"
        ? supabase.schema("pcm").rpc("sso_historico_rateio_despesa_mediado",{...parametros,p_ator_id:userId})
        : supabase.schema("pcm").rpc("sso_historico_rateio_despesa",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error;const pagina=z.array(registro).max(20).parse(data);let anterior=pageParam;
      for(const item of pagina){if(item.revisao<=anterior||new Set(item.parcelas.map(p=>p.vinculoId.toLowerCase())).size!==item.parcelas.length)throw new Error("Página divergente.");anterior=item.revisao;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.revisao : undefined });
  if (import.meta.env.VITE_SSO_HISTORICO_RATEIO_ENABLED !== "true") return null;
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar histórico de rateio" : "Ver histórico de rateio"}</button>
    {aberto && lista.isFetching && <p>Consultando histórico…</p>}
    {aberto && lista.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {aberto && !lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhum rateio registrado.</p>}
    {aberto && !lista.isFetching && !lista.isError && lista.data?.pages.flat().map((r) => <article key={r.revisao}>
      <p>Revisão {r.revisao} · {new Date(r.criado_em).toLocaleString("pt-BR")} · responsável {r.ator_id}</p>
      {r.parcelas.length === 0 ? <p>Rateio removido nesta versão.</p> : <ul>{r.parcelas.map((p) => <li key={p.vinculoId}>
        OS {p.osId ?? "não identificada"} · {p.valorCentavos} centavos · vínculo {p.vinculo}
      </li>)}</ul>}
    </article>)}
    {aberto && !lista.isError && lista.hasNextPage && <button type="button" disabled={lista.isFetching} onClick={() => void lista.fetchNextPage()}>Mais versões</button>}
    {aberto && <p>A situação dos vínculos reflete a consulta atual, não necessariamente a situação na época do rateio.</p>}
  </section>;
}
