import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ConferenciaEventoCampo } from "./ConferenciaEventoCampo";

const resposta = z.object({ clienteId: z.string().guid(), osId: z.string().guid(), ordemExterna: z.string().regex(/^[1-9]\d{0,17}$/),
  statusCampo: z.enum(["aberta", "em_andamento", "concluida"]), titulo: z.string().max(200).nullable(), descricao: z.string().max(10000).nullable(),
  tecnicoAuvoId: z.string().max(18).nullable(), dataAgendada: z.string().max(40).nullable(), checkIn: z.string().max(40).nullable(), checkOut: z.string().max(40).nullable(),
  validacaoPcmComprovada: z.literal(false), osAlterada: z.literal(false) }).strict();

export function DetalheUltimoEvento({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const [aberto, setAberto] = useState(false);
  const q = useQuery({ queryKey: ["estado-origem-campo", userId, clienteId, osId, "detalhe"], enabled: aberto, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_detalhar_ultimo_evento_campo", { p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error;
      const r = resposta.parse(data);
      if (r.clienteId.toLowerCase() !== clienteId.toLowerCase() || r.osId.toLowerCase() !== osId.toLowerCase()) throw new Error("Origem divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return r;
    } });
  return <section aria-label={`Detalhe de campo da OS ${osId}`}>
    <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar detalhe de campo" : "Consultar detalhe de campo"}</button>
    {aberto && <><p>Último evento aceito da origem. Informações declaradas não substituem a validação do PCM nem alteram a OS.</p>
      {q.isFetching && <output>Consultando detalhe…</output>}
      {q.isError && <p role="alert">Detalhe indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
      {!q.isFetching && !q.isError && q.data && <dl>
        <dt>Ordem da origem</dt><dd>{q.data.ordemExterna}</dd><dt>Estado em campo</dt><dd>{q.data.statusCampo}</dd>
        <dt>Título declarado</dt><dd>{q.data.titulo ?? "Não informado"}</dd><dt>Descrição declarada</dt><dd>{q.data.descricao ?? "Não informada"}</dd>
        <dt>Identificador do técnico no Auvo</dt><dd>{q.data.tecnicoAuvoId ?? "Não informado"}</dd>
        <dt>Agendamento declarado</dt><dd>{q.data.dataAgendada ?? "Não informado"}</dd>
        <dt>Entrada declarada</dt><dd>{q.data.checkIn ?? "Não informada"}</dd><dt>Saída declarada</dt><dd>{q.data.checkOut ?? "Não informada"}</dd>
      </dl>}
      <ConferenciaEventoCampo userId={userId} clienteId={clienteId} osId={osId} />
    </>}
  </section>;
}
