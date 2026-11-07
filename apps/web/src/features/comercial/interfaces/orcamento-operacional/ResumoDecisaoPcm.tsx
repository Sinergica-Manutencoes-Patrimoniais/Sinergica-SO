import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ decisao: z.enum(["aceita", "recusada"]), ator_id: z.string().guid(), criado_em: z.string() }).strict();
export function ResumoDecisaoPcm({ usuario, cliente, os, proposta, versao }: { usuario: string; cliente: string; os: string; proposta: string; versao: number }) {
 const consulta = useQuery({ queryKey: ["decisao-pcm-orcamento", usuario, cliente, os, proposta, versao], gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true,
  queryFn: async ({ signal }) => { const { data, error } = await supabase.schema("comercial").rpc("sso_consultar_decisao_pcm_orcamento", { p_cliente_id: cliente, p_os_id: os, p_proposta_id: proposta, p_versao: versao }).abortSignal(signal); if (error) throw error; return z.array(linha).max(1).parse(data); } });
 if (consulta.isPending || consulta.isFetching) return <span> · consultando decisão PCM…</span>;
 if (consulta.isError) return <span> · decisão PCM indisponível ou sem autorização</span>;
 const registro = consulta.data?.[0];
 return registro ? <span> · decisão interna PCM: {registro.decisao} (não é aceite direto do Cliente)</span> : <span> · decisão PCM não registrada nesta versão</span>;
}
