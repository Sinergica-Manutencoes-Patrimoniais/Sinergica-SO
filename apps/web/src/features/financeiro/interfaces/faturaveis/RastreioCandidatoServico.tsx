import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const resposta = z.object({ clienteId: uuid, itemId: uuid, fatoId: uuid, declaracaoId: uuid, snapshotId: uuid, osId: uuid,
  propostaId: uuid, versao: z.number().int().positive(), linhaId: uuid, revisaoPcmId: uuid,
  execucaoFisicaComprovada: z.literal(false), exclusividadeComprovada: z.literal(false), autorizaFaturamento: z.literal(false) }).strict();

export function RastreioCandidatoServico(props: { usuario: string; cliente: string; itemId: string }) {
  if (import.meta.env.VITE_SSO_RASTREIO_CANDIDATO_SERVICO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.usuario, props.cliente, props.itemId])} {...props} />;
}
function Conteudo({ usuario, cliente, itemId }: { usuario: string; cliente: string; itemId: string }) {
  const consulta = useQuery({ queryKey: ["rastreio-candidato-servico", usuario, cliente, itemId], enabled: false, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("financeiro").rpc("sso_rastrear_candidato_servico", { p_cliente_id: cliente, p_item_id: itemId }).abortSignal(signal);
      if (error) throw error; const r = resposta.parse(data);
      if (r.clienteId.toLowerCase() !== cliente.toLowerCase() || r.itemId.toLowerCase() !== itemId.toLowerCase()) throw new Error("Identidade divergente.");
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      return r;
    } });
  const dados = !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  return <section aria-label="Origem do candidato de serviço">
    <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.refetch()}>Consultar origem do serviço</button>
    {consulta.isFetching && <output>Consultando origem…</output>}
    {consulta.isError && <p role="alert">Origem indisponível ou inconsistente. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {dados && <p>OS {dados.osId} · proposta {dados.propostaId} v{dados.versao} · linha {dados.linhaId} · declaração {dados.declaracaoId} · fotografia {dados.snapshotId} · fato {dados.fatoId} · revisão PCM {dados.revisaoPcmId}. Rastreio não comprova execução nem autoriza faturamento.</p>}
  </section>;
}
