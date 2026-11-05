import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

const linha = z.object({ vinculo_id: z.string().uuid(), versao_id: z.string().uuid(), rotina_id: z.string().uuid(), alvo_tipo: z.enum(["sistema", "componente", "grupo"]), alvo_id: z.string().uuid(), vencimento: z.string().date(), agendamento_id: z.string().uuid(), status_pmoc: z.string().nullable(), estado_vinculo: z.enum(["declarado_pcm", "revisao_necessaria", "conflito"]) }).strict();
type Props = { userId: string; clienteId: string; planoId: string };
export function ObrigacoesPmoc(props: Props) { if (import.meta.env.VITE_SSO_OBRIGACOES_PMOC_ENABLED !== "true") return null; return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.planoId])} {...props} />; }
function Conteudo({ userId, clienteId, planoId }: Props) {
 const consulta = useInfiniteQuery({ queryKey: ["obrigacoes-pmoc-plano", userId, clienteId, planoId], gcTime: 0, retry: false, initialPageParam: null as string | null,
  queryFn: async ({ pageParam, signal }) => { await conferirSessaoDiagnostico(userId, signal); const { data, error } = await supabase.schema("pcm").rpc("sso_listar_obrigacoes_pmoc_plano", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; const pagina = z.array(linha).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? ""; for (const item of pagina) { if (item.vinculo_id.toLowerCase() <= anterior) throw new Error("Página divergente."); anterior = item.vinculo_id.toLowerCase(); } await conferirSessaoDiagnostico(userId, signal); return pagina; },
  getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.vinculo_id : undefined });
 const itens = consulta.data?.pages.flat() ?? []; const consistentes = itens.every((item, i) => i === 0 || item.vinculo_id.toLowerCase() > itens[i - 1]!.vinculo_id.toLowerCase());
 const visiveis = !!consulta.data && !consulta.isFetching && !consulta.isError && consistentes;
 const estado: Record<string, string> = { declarado_pcm: "vínculo declarado pelo PCM", revisao_necessaria: "vínculo precisa de revisão", conflito: "vínculos conflitantes" };
 return <section aria-label="Ciclos vinculados ao PMOC"><h4>Ciclos vinculados ao PMOC</h4><p>Mostra somente vínculos declarados neste Plano. Ausência aqui não comprova ausência de agendamentos PMOC. A lista não altera OS ou tarefas.</p>
 {consulta.isFetching && <p role="status">Consultando vínculos PMOC…</p>}{consulta.isError && <p role="alert">Vínculos PMOC indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}{!consulta.isFetching && !consulta.isError && !consistentes && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
 {visiveis && itens.length === 0 && <p>Nenhum vínculo declarado neste Plano.</p>}
 {visiveis && <ul>{itens.map((item) => <li key={item.vinculo_id}>Vencimento {item.vencimento} · alvo {item.alvo_tipo} {item.alvo_id} · Rotina {item.rotina_id} · agendamento {item.agendamento_id} · situação PMOC {item.status_pmoc ?? "indisponível"} · {estado[item.estado_vinculo]}</li>)}</ul>}
 {visiveis && consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais vínculos</button>}</section>;
}
