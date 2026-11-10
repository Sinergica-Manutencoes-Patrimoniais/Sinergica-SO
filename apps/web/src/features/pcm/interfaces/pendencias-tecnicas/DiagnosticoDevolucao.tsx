import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { CandidatosDevolucaoCiclo } from "./CandidatosDevolucaoCiclo";
import { CiclosPosteriores } from "./CiclosPosteriores";

const linhaSchema = z.object({
  pendencia_id: z.string().guid(), parcela_id: z.string().guid(), situacao: z.string(),
  suspensao_declarada: z.boolean(), os_atribuida: z.boolean(), interrupcao_declarada: z.boolean(),
  prova_parada_disponivel: z.boolean(),
}).strict();

/** Sinais administrativos não autorizam devolver nem comprovam execução ou parada. */
export function DiagnosticoDevolucao({ userId, clienteId, composicaoId }: {
  userId: string; clienteId: string; composicaoId: string;
}) {
  const consulta = useInfiniteQuery({
    queryKey: ["backlog-vinculo", userId, clienteId, composicaoId, "diagnostico-devolucao"],
    initialPageParam: null as string | null, gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_diagnostico_devolucao_parcial", {
        p_composicao_id: composicaoId, p_apos: pageParam, p_limite: 20,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linhaSchema).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const linha of pagina) {
        const atual = linha.pendencia_id.toLowerCase();
        if (anterior !== null && atual <= anterior) throw new Error("Página de diagnóstico divergente.");
        anterior = atual;
      }
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.pendencia_id : undefined,
  });
  return <section aria-label="Sinais para devolução de escopo">
    <h5>Sinais administrativos por parcela</h5>
    <p>Informações parciais: não comprovam parada nem autorizam devolução do escopo.</p>
    {import.meta.env.VITE_SSO_CANDIDATOS_DEVOLUCAO_CICLO_ENABLED === "true" && <CandidatosDevolucaoCiclo userId={userId} clienteId={clienteId} composicaoId={composicaoId} />}
    {import.meta.env.VITE_SSO_CICLOS_POSTERIORES_ENABLED === "true" && <CiclosPosteriores userId={userId} clienteId={clienteId} composicaoId={composicaoId} />}
    {consulta.isFetching && <output>Consultando sinais…</output>}
    {consulta.isError && <p role="alert">Não foi possível consultar os sinais. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <>
      {consulta.data.pages.flat().length === 0 && <p>Nenhuma parcela encontrada.</p>}
      <ul>{consulta.data.pages.flat().map((linha) => <li key={linha.pendencia_id}>
        Pendência {linha.pendencia_id} · parcela {linha.parcela_id} · {linha.situacao}
        <ul>
          <li>Suspensão declarada: {linha.suspensao_declarada ? "sim" : "não"}</li>
          <li>OS atribuída: {linha.os_atribuida ? "sim" : "não"}</li>
          <li>Interrupção declarada: {linha.interrupcao_declarada ? "sim" : "não"}</li>
          <li>Prova de parada disponível: {linha.prova_parada_disponivel ? "sim" : "não"}</li>
        </ul>
      </li>)}</ul>
      {consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais sinais</button>}
    </>}
  </section>;
}
