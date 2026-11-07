import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid();
const base = { planoId: id, versaoId: id, rotinaId: id };
const respostaSchema = z.union([
  z.object({ ...base, copiada: z.literal(false) }).strict(),
  z.object({ ...base, copiada: z.literal(true), origemAcessivel: z.literal(false), conferenciaNecessaria: z.literal(true) }).strict(),
  z.object({ ...base, copiada: z.literal(true), origemAcessivel: z.literal(true), conferenciaNecessaria: z.literal(true),
    origemClienteId: id, origemPlanoId: id, origemVersaoId: id, origemRotinaId: id, copiadaEm: z.string().min(1) }).strict(),
]);

export function ProvenienciaRotinaModelo({ userId, clienteId, planoId, versaoId, rotinaId }: {
  userId: string; clienteId: string; planoId: string; versaoId: string; rotinaId: string;
}) {
  const consulta = useQuery({
    queryKey: ["proveniencia-rotina-modelo", userId, clienteId, planoId, versaoId, rotinaId], gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_proveniencia_rotina_modelo", {
        p_cliente_id: clienteId, p_plano_id: planoId, p_versao_id: versaoId, p_rotina_id: rotinaId,
      }).abortSignal(signal);
      if (error) throw error;
      const resultado = respostaSchema.parse(data);
      if (resultado.planoId !== planoId || resultado.versaoId !== versaoId || resultado.rotinaId !== rotinaId) throw new Error("Destino divergente");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada");
      return resultado;
    },
  });
  return <aside aria-label="Procedência da Rotina">
    {consulta.isFetching && <p role="status">Conferindo procedência…</p>}
    {consulta.isError && <p role="alert">Procedência indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (consulta.data.copiada ? <>
      <p>Rotina criada por cópia. Confira questionário, alvo, recorrência e exigências antes da aprovação. Esta consulta não registra a conferência.</p>
      {consulta.data.origemAcessivel ? <p>Origem: Cliente {consulta.data.origemClienteId}, Plano {consulta.data.origemPlanoId}, versão {consulta.data.origemVersaoId}, Rotina {consulta.data.origemRotinaId}. Cópia em {consulta.data.copiadaEm}.</p> : <p>A origem está restrita à equipe autorizada.</p>}
    </> : <p>Esta Rotina não possui registro de cópia neste fluxo; isso não prova ausência de outra origem.</p>)}
  </aside>;
}
