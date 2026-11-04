import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const item = z.object({ id: z.string().uuid(), tipo: z.enum(["visita", "pendencia"]), os_id: z.string().uuid(), publicado_em: z.string(), descricao: z.string() }).strict();
export function DetalheComunicacao({ userId, clienteId, publicacaoId, tipo }: { userId: string; clienteId: string; publicacaoId: string; tipo: "visita" | "pendencia" }) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({ queryKey: ["portal-comunicacao", userId, clienteId, tipo, publicacaoId], enabled: aberto,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_portal_comunicacao", { p_cliente_id: clienteId, p_tipo: tipo, p_publicacao_id: publicacaoId }).abortSignal(signal);
      if (error) throw error; const resultado = z.array(item).length(1).parse(data)[0]!;
      if (resultado.id !== publicacaoId || resultado.tipo !== tipo) throw new Error("Resposta divergente"); return resultado;
    } });
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Fechar comunicação" : "Consultar comunicação"}</button>
    {aberto && consulta.isFetching && <p>Consultando…</p>}
    {aberto && consulta.isError && <p role="alert">Comunicação indisponível ou retirada. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {aberto && !consulta.isFetching && !consulta.isError && consulta.data && <div><p>{consulta.data.descricao}</p>
      <p>Consultar não registra ciência, confirmação ou leitura.</p></div>}
  </section>;
}
