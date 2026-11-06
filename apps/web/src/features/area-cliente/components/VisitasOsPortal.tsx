import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { ConfirmacaoVisita } from "./ConfirmacaoVisita";

type Props = { userId: string; clienteId: string; osId: string };
const visita = z.object({ id: z.string().uuid(), inicio_em: z.string(), fim_em: z.string(), mensagem: z.string(), ciente_em: z.string().nullable() }).strict();
export function VisitasOsPortal(props: Props) {
  if (import.meta.env.VITE_SSO_PORTAL_VISITAS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId }: Props) {
  const chave = ["portal-visitas-os", userId, clienteId, osId];
  const cache = useQueryClient();
  const consulta = useQuery({ queryKey: chave, gcTime: 0, retry: false, staleTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_portal_visitas_os", { p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; return z.array(visita).parse(data);
    } });
  const ciencia = useMutation({ mutationFn: async (id: string) => {
    const { error } = await supabase.schema("pcm").rpc("sso_portal_ciente_visita", { p_publicacao_id: id });
    if (error) throw error;
  }, onSuccess: () => cache.invalidateQueries({ queryKey: chave }) });
  return <section aria-label="Visitas comunicadas"><h3>Visitas comunicadas</h3>
    <p>Registrar ciência é informativo: não confirma o atendimento nem autoriza envio de tarefas.</p>
    {consulta.isFetching && <p>Consultando visitas…</p>}
    {consulta.isError && <p role="alert">Visitas indisponíveis ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.length === 0 && <p>Nenhuma visita comunicada.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.map((v) => <div key={v.id}>
      <p>{new Date(v.inicio_em).toLocaleString("pt-BR")} – {new Date(v.fim_em).toLocaleString("pt-BR")}</p><p>{v.mensagem}</p>
      {v.ciente_em ? <p>Você registrou ciência em {new Date(v.ciente_em).toLocaleString("pt-BR")}.</p> :
        <button type="button" disabled={ciencia.isPending} onClick={() => ciencia.mutate(v.id)}>Registrar ciência</button>}
      {import.meta.env.VITE_SSO_CONFIRMACAO_CLIENTE_VISITA_ENABLED === "true" && <ConfirmacaoVisita userId={userId} clienteId={clienteId} osId={osId} publicacaoId={v.id} />}
    </div>)}
    {ciencia.isError && <p role="alert">Não foi possível registrar ciência; atualize a lista e tente novamente.</p>}
  </section>;
}
