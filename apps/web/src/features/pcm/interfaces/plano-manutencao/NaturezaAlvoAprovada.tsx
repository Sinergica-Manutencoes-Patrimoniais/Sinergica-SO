import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; planoId: string; versaoId: string; rotinaId: string; alvoId: string };
export function NaturezaAlvoAprovada(props: Props) {
  if (import.meta.env.VITE_SSO_NATUREZA_ALVO_ROTINA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.versaoId, props.rotinaId, props.alvoId])} {...props} />;
}
function Conteudo({ userId, clienteId, planoId, versaoId, rotinaId, alvoId }: Props) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({
    queryKey: ["natureza-alvo-aprovada", userId, clienteId, planoId, versaoId, rotinaId, alvoId],
    enabled: aberto, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_natureza_alvo_aprovada", {
        p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_versao_id: versaoId, p_rotina_id: rotinaId,
      }).abortSignal(signal);
      if (error) throw error;
      const id = z.string().guid();
      const r = z.object({ planoId: id, versaoId: id, rotinaId: id, alvoId: id,
        natureza: z.enum(["equipamento", "componente"]).nullable() }).strict().parse(data);
      if (r.planoId !== planoId || r.versaoId !== versaoId || r.rotinaId !== rotinaId || r.alvoId !== alvoId)
        throw new Error("Fotografia divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return r;
    },
  });
  return <section aria-label="Natureza histórica do alvo">
    <button type="button" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)}>{aberto ? "Ocultar natureza histórica" : "Consultar natureza histórica"}</button>
    {aberto && <>{consulta.isFetching && <output>Consultando fotografia…</output>}
      {consulta.isError && <p role="alert">Natureza histórica indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && consulta.data && <p>Natureza no Plano aprovado: {consulta.data.natureza ?? "não declarada na fotografia"}. O cadastro atual não altera este histórico.</p>}</>}
  </section>;
}
