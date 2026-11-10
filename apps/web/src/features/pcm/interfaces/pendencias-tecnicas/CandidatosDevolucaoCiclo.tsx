import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ComandosCicloDevolucao } from "./ComandosCicloDevolucao";
import { ContinuacoesParcelaCiclo } from "./ContinuacoesParcelaCiclo";

const id = z.string().guid();
const revisao = z.number().int().positive().nullable();
export const candidatoDevolucaoSchema = z.object({ pendencia_id: id, parcela_id: id, chamado_id: id, situacao: z.string(), ciclo_id: id.nullable(),
  ciclo_estado: z.enum(["em_tratamento", "devolvido", "concluido"]).nullable(), ciclo_revisao: revisao,
  suspensao_estado: z.enum(["suspenso", "retomado"]).nullable(), suspensao_revisao: revisao,
  os_id: id.nullable(), os_status: z.string().nullable(), interrupcao_estado: z.enum(["declarada", "revogada"]).nullable(),
  interrupcao_revisao: revisao, reconciliacao_id: id.nullable(), reconciliacao_estado: z.enum(["nao_executada_declarada", "incerta"]).nullable(),
  reconciliacao_suspensao_revisao: revisao, reconciliacao_interrupcao_revisao: revisao, prova_parada_disponivel: z.literal(false),
}).strict();
export type CandidatoDevolucao = z.infer<typeof candidatoDevolucaoSchema>;

export function CandidatosDevolucaoCiclo({ userId, clienteId, composicaoId }: { userId: string; clienteId: string; composicaoId: string }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [continuacaoSelecionada, setContinuacaoSelecionada] = useState<string | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["backlog-candidatos-ciclo", userId, clienteId, composicaoId], initialPageParam: null as string | null,
    gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_candidatos_devolucao_ciclo", {
        p_cliente_id: clienteId, p_composicao_id: composicaoId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(candidatoDevolucaoSchema).max(50).parse(data);
      let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.pendencia_id <= anterior) throw new Error("Página divergente"); anterior = item.pendencia_id; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.pendencia_id : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Candidatos de devolução por ciclo">
    <h5>Candidatos de devolução por ciclo</h5>
    <p>Diagnóstico do vínculo legado. Não comprova parada remota nem autoriza devolução; os dados podem mudar entre páginas.</p>
    {consulta.isFetching && <p role="status">Consultando ciclos…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && <div hidden={consulta.isFetching || consulta.isError}>{itens.length === 0 ? <p>Nenhuma parcela encontrada.</p> : <ul>{itens.map((item) => <li key={item.pendencia_id}>
      Pendência {item.pendencia_id} · parcela {item.parcela_id} ({item.situacao}).
      <p>Ciclo: {item.ciclo_id ? `${item.ciclo_estado} · revisão ${item.ciclo_revisao}` : "não inicializado"}. Suspensão: {item.suspensao_estado ?? "não registrada"} · revisão {item.suspensao_revisao ?? "—"}.</p>
      <p>OS: {item.os_id ?? "não atribuída"} · situação {item.os_status ?? "indisponível"}. Interrupção: {item.interrupcao_estado ?? "não registrada"} · revisão {item.interrupcao_revisao ?? "—"}.</p>
      <p>Reconciliação: {item.reconciliacao_estado ?? "não registrada"} {item.reconciliacao_id ?? ""}. Prova de parada: não disponível.</p>
      {import.meta.env.VITE_SSO_CONTINUACAO_PARCELA_CICLO_ENABLED === "true" && item.ciclo_id && <><button type="button" aria-expanded={continuacaoSelecionada === item.ciclo_id} onClick={() => setContinuacaoSelecionada(continuacaoSelecionada === item.ciclo_id ? null : item.ciclo_id)}>Consultar continuidade</button>{continuacaoSelecionada === item.ciclo_id && <ContinuacoesParcelaCiclo key={`${userId}:${clienteId}:${item.ciclo_id}:${item.parcela_id}`} userId={userId} clienteId={clienteId} composicaoId={composicaoId} cicloId={item.ciclo_id} parcelaId={item.parcela_id} />}</>}
      {import.meta.env.VITE_SSO_COMANDOS_DEVOLUCAO_CICLO_ENABLED === "true" && <><button type="button" aria-expanded={selecionada === item.pendencia_id} onClick={() => setSelecionada(selecionada === item.pendencia_id ? null : item.pendencia_id)}>{selecionada === item.pendencia_id ? "Fechar comandos" : "Abrir comandos ou recuperar pedido"}</button>
        {selecionada === item.pendencia_id && <ComandosCicloDevolucao key={`${userId}:${clienteId}:${composicaoId}:${item.pendencia_id}`} userId={userId} clienteId={clienteId} composicaoId={composicaoId} candidato={item} disponivel={!consulta.isFetching && !consulta.isError} />}</>}
    </li>)}</ul>}</div>}
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais candidatos</button>}
  </section>;
}
