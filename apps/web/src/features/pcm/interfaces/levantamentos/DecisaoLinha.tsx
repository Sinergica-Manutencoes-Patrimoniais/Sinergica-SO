import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

const decisaoSchema = z.array(z.object({
  decisao: z.enum(["rejeitada", "incorporada", "atualizada", "vinculada"]), revisao: z.number().int().positive(),
  motivo: z.string().nullable(), tipo: z.string().nullable(), entidade_id: z.string().guid().nullable(),
  ator_id: z.string().guid(), ocorrido_em: z.string().datetime({ offset: true }),
}).strict()).max(1);

type Props = { userId: string; clienteId: string; loteId: string; chave: string; revisao: number };
export function DecisaoLinha(props: Props) {
  if (import.meta.env.VITE_SSO_HISTORICO_LEVANTAMENTO_ENABLED !== "true") return null;
  return <Consulta key={JSON.stringify([props.userId, props.clienteId, props.loteId, props.chave])} {...props} />;
}

function Consulta({ userId, clienteId, loteId, chave, revisao }: Props) {
  const permissao = useQuery({ queryKey: ["levantamentos", userId, clienteId, "incorporacao-permissao"],
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar", clienteId),
    gcTime: 0, refetchOnWindowFocus: true });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const decisao = useQuery({
    queryKey: ["levantamentos", userId, clienteId, loteId, chave, "decisao", revisao],
    enabled: permitido, gcTime: 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_decisao_linha_autorizada", {
        p_lote_id: loteId, p_chave: chave,
      }).abortSignal(signal);
      if (error) throw error;
      return decisaoSchema.parse(data);
    },
  });
  if (permissao.isPending || permissao.isFetching) return <output>Verificando acesso à decisão…</output>;
  if (permissao.isError) return <p role="alert">Não foi possível verificar acesso. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (!permitido) return null;
  if (decisao.isPending || decisao.isFetching) return <output>Carregando decisão…</output>;
  if (decisao.isError) return <p role="alert">Não foi possível carregar a decisão. <button type="button" onClick={() => void decisao.refetch()}>Tentar novamente</button></p>;
  const item = decisao.data[0];
  if (!item) return <p>Sem decisão registrada para esta linha.</p>;
  return <section aria-label={`Decisão da linha ${chave}`}>
    <p>{item.decisao === "rejeitada" ? "Linha rejeitada" : item.decisao === "atualizada" ? "Cadastro atualizado" : item.decisao === "vinculada" ? "Linha vinculada a cadastro existente, sem alterá-lo" : "Linha incorporada"} · revisão {item.revisao} · {new Date(item.ocorrido_em).toLocaleString("pt-BR")}</p>
    <p>Responsável: {item.ator_id}</p>
    {item.motivo && <p>Motivo: {item.motivo}</p>}
    {item.entidade_id && <p>Cadastro associado: {item.tipo} · {item.entidade_id}</p>}
  </section>;
}
