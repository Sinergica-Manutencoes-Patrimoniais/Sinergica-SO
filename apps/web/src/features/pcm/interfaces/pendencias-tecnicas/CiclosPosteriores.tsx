import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { candidatoDevolucaoSchema } from "./CandidatosDevolucaoCiclo";
import { ComandosCicloDevolucao } from "./ComandosCicloDevolucao";
import { OsCicloPosterior } from "./OsCicloPosterior";
import { ReconciliacaoCicloPosterior } from "./ReconciliacaoCicloPosterior";
import { ContinuacoesParcelaCiclo } from "./ContinuacoesParcelaCiclo";

export function CiclosPosteriores({ userId, clienteId, composicaoId }: { userId: string; clienteId: string; composicaoId: string }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [osSelecionada, setOsSelecionada] = useState<string | null>(null);
  const [reconciliacaoSelecionada, setReconciliacaoSelecionada] = useState<string | null>(null);
  const [continuacaoSelecionada, setContinuacaoSelecionada] = useState<string | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["backlog-ciclos-posteriores", userId, clienteId, composicaoId], initialPageParam: null as string | null,
    gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_candidatos_ciclos_posteriores", {
        p_cliente_id: clienteId, p_composicao_id: composicaoId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(candidatoDevolucaoSchema).max(50).parse(data);
      let anterior = pageParam ?? "";
      for (const item of pagina) { if (!item.ciclo_id || item.ciclo_id <= anterior) throw new Error("Página divergente"); anterior = item.ciclo_id; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.ciclo_id ?? undefined : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Ciclos posteriores do Backlog">
    <h5>Ciclos posteriores</h5>
    <p>Histórico separado do vínculo original. Não comprova parada da execução nem sincronização remota; páginas podem mudar.</p>
    {consulta.isFetching && <p role="status">Consultando ciclos posteriores...</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && <div hidden={consulta.isFetching || consulta.isError}>{itens.length === 0 ? <p>Nenhum ciclo posterior encontrado.</p> : <ul>{itens.map((item) => <li key={item.ciclo_id}>
      Ciclo {item.ciclo_id} · {item.ciclo_estado} · revisão {item.ciclo_revisao}. Pendência {item.pendencia_id}, Chamado {item.chamado_id}, parcela {item.parcela_id} ({item.situacao}).
      <p>Suspensão {item.suspensao_estado ?? "não registrada"} · OS {item.os_id ?? "não atribuída"} ({item.os_status ?? "indisponível"}) · interrupção {item.interrupcao_estado ?? "não registrada"} · reconciliação {item.reconciliacao_estado ?? "não registrada"}. Prova de parada indisponível.</p>
      {import.meta.env.VITE_SSO_CONTINUACAO_PARCELA_CICLO_ENABLED === "true" && item.ciclo_id && <><button type="button" aria-expanded={continuacaoSelecionada === item.ciclo_id} onClick={() => setContinuacaoSelecionada(continuacaoSelecionada === item.ciclo_id ? null : item.ciclo_id)}>Consultar continuidade</button>{continuacaoSelecionada === item.ciclo_id && <ContinuacoesParcelaCiclo key={`${userId}:${clienteId}:${item.ciclo_id}:${item.parcela_id}`} userId={userId} clienteId={clienteId} composicaoId={composicaoId} cicloId={item.ciclo_id} parcelaId={item.parcela_id} />}</>}
      {import.meta.env.VITE_SSO_RECONCILIACAO_CICLO_POSTERIOR_ENABLED === "true" && item.ciclo_id && <>
        <button type="button" aria-expanded={reconciliacaoSelecionada === item.ciclo_id} onClick={() => setReconciliacaoSelecionada(reconciliacaoSelecionada === item.ciclo_id ? null : item.ciclo_id)}>Consultar reconciliação</button>
        {reconciliacaoSelecionada === item.ciclo_id && <ReconciliacaoCicloPosterior key={`${userId}:${clienteId}:${item.ciclo_id}:${item.parcela_id}`} userId={userId} clienteId={clienteId} composicaoId={composicaoId} cicloId={item.ciclo_id} parcelaId={item.parcela_id} />}
      </>}
      {import.meta.env.VITE_SSO_OS_CICLO_POSTERIOR_ENABLED === "true" && item.ciclo_id && <>
        <button type="button" aria-expanded={osSelecionada === item.ciclo_id} onClick={() => setOsSelecionada(osSelecionada === item.ciclo_id ? null : item.ciclo_id)}>Consultar OS e declarações</button>
        {osSelecionada === item.ciclo_id && <><OsCicloPosterior key={`${item.ciclo_id}:atribuir`} userId={userId} clienteId={clienteId} composicaoId={composicaoId} cicloId={item.ciclo_id} parcelaId={item.parcela_id} modo="atribuir" />
          <OsCicloPosterior key={`${item.ciclo_id}:interromper`} userId={userId} clienteId={clienteId} composicaoId={composicaoId} cicloId={item.ciclo_id} parcelaId={item.parcela_id} modo="interromper" /></>}
      </>}
      {import.meta.env.VITE_SSO_COMANDOS_DEVOLUCAO_CICLO_ENABLED === "true" && <><button type="button" aria-expanded={selecionado === item.ciclo_id} onClick={() => setSelecionado(selecionado === item.ciclo_id ? null : item.ciclo_id)}>{selecionado === item.ciclo_id ? "Fechar comandos" : "Abrir comandos ou recuperar pedido"}</button>
        {selecionado === item.ciclo_id && <ComandosCicloDevolucao key={`${userId}:${clienteId}:${composicaoId}:${item.ciclo_id}`} userId={userId} clienteId={clienteId} composicaoId={composicaoId} candidato={item} disponivel={!consulta.isFetching && !consulta.isError} />}</>}
    </li>)}</ul>}</div>}
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais ciclos</button>}
  </section>;
}
