import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const schema = z.object({ visitaId: z.string().uuid(), revision: z.number().int().positive(), politicaModo: z.enum(["sem_controle", "informativa", "obrigatoria"]),
  situacao: z.enum(["pendente_pcm", "politica_desatualizada", "nao_exigida", "fonte_indisponivel", "confirmada_portal", "confirmacao_pendente"]),
  confirmacaoEncontrada: z.boolean(), autorizaEnvio: z.literal(false) }).strict();
const rotulos: Record<z.infer<typeof schema>["situacao"], string> = { pendente_pcm: "Confirmação do PCM pendente", politica_desatualizada: "Política alterada; reavaliar programação",
  nao_exigida: "Confirmação do Cliente não exigida", fonte_indisponivel: "Fonte de confirmação indisponível", confirmada_portal: "Confirmação explícita registrada no Portal", confirmacao_pendente: "Confirmação explícita do Cliente pendente" };
export function ConferenciaConfirmacaoCliente({ userId, clienteId, visitaId, revisao }: { userId: string; clienteId: string; visitaId: string; revisao: number }) {
  const consulta = useQuery({ queryKey: ["visitas", userId, clienteId, "confirmacao-cliente", visitaId, revisao], gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: true, queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_confirmacao_cliente_visita", { p_visita_id: visitaId }).abortSignal(signal);
      if (error) throw error; const resultado = schema.parse(data); if (resultado.visitaId !== visitaId) throw new Error("Resposta divergente"); return resultado; } });
  return <section aria-label="Confirmação explícita do Cliente">
    {consulta.isFetching && <p>Conferindo confirmação do Cliente…</p>}
    {consulta.isError && <p role="alert">Confirmação indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <p>{rotulos[consulta.data.situacao]} · {consulta.data.revision !== revisao ? "revisão desatualizada; atualize a Visita. " : ""}Consulta informativa; não autoriza envio.</p>}
  </section>;
}
