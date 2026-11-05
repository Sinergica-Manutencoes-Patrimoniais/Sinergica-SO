import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
const schema = z
  .object({
    respostaId: z.string().uuid(),
    original: z.object({ resultado: z.string(), observacao: z.string().nullable() }).strict(),
    proposta: z
      .object({
        id: z.string().uuid(),
        revisao: z.number().int().positive(),
        resultado: z.string(),
        observacao: z.string().nullable(),
        decisao: z.enum(["aceita", "rejeitada"]).nullable(),
        decisaoRevisao: z.number().int().positive().nullable(),
      })
      .strict()
      .nullable(),
    efetivada: z.literal(false),
    integracaoTransversalConcluida: z.literal(false),
  })
  .strict();
export function PreviaReclassificacaoResposta({
  userId,
  clienteId,
  respostaId,
}: { userId: string; clienteId: string; respostaId: string }) {
  if (import.meta.env.VITE_SSO_PREVIA_RECLASSIFICACAO_ENABLED !== "true") return null;
  return (
    <Conteudo
      key={JSON.stringify([userId, clienteId, respostaId])}
      userId={userId}
      clienteId={clienteId}
      respostaId={respostaId}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  respostaId,
}: { userId: string; clienteId: string; respostaId: string }) {
  const q = useQuery({
    queryKey: ["retorno-reclassificacao-previa", userId, clienteId, respostaId],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_previa_reclassificacao_mediada", {
          p_cliente_id: clienteId,
          p_resposta_id: respostaId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = schema.parse(data);
      if (r.respostaId !== respostaId) throw new Error("Resposta divergente");
      return r;
    },
  });
  return (
    <section>
      <h5>Prévia de reclassificação</h5>
      <p>
        Propostas e decisões não alteram a resposta efetiva. Integração com validação, encerramento
        e Pendências ainda não concluída.
      </p>
      {q.isPending && <output>Consultando…</output>}
      {q.isError && (
        <p role="alert">
          Prévia indisponível.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {q.data && (
        <>
          <p>
            Original: {q.data.original.resultado} · {q.data.original.observacao ?? "sem observação"}
          </p>
          {q.data.proposta ? (
            <p>
              Última proposta: {q.data.proposta.resultado} ·{" "}
              {q.data.proposta.observacao ?? "sem observação"} · revisão {q.data.proposta.revisao} ·
              decisão {q.data.proposta.decisao ?? "não registrada"}. Não efetivada.
            </p>
          ) : (
            <p>Nenhuma proposta nesta fonte.</p>
          )}
        </>
      )}
    </section>
  );
}
