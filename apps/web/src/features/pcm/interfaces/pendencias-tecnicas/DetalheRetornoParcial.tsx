import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { PromoverContinuidadeAtomica } from "./PromoverContinuidadeAtomica";
import { HistoricoPromocaoParcial } from "./HistoricoPromocaoParcial";

const id = z.string().uuid();
const detalhe = z.object({ id, ciclo_id: id, pendencia_id: id, composicao_id: id, chamado_id: id, parcela_id: id, os_id: id, proposta_id: id,
  descricao_restante: z.string().min(1).max(4000), minutos_restantes: z.number().int().positive(), estado: z.enum(["aguardando", "promovido"]),
  revisao: z.number().int().positive(), criado_em: z.string().datetime({ offset: true }) }).strict();

export function DetalheRetornoParcial({ userId, clienteId, retornoId }: { userId: string; clienteId: string; retornoId: string }) {
  const consulta = useQuery({ queryKey: ["backlog-retorno-parcial-detalhe", userId, clienteId, retornoId], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_detalhar_retorno_parcial", { p_ator_id: userId, p_cliente_id: clienteId, p_retorno_id: retornoId }).abortSignal(signal);
      if (error) throw error; const itens = z.array(detalhe).max(1).parse(data); const item = itens[0] ?? null;
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted || (item && item.id !== retornoId)) throw new Error("Contexto divergente");
      return item;
    } });
  const item = consulta.data;
  return <section aria-label="Retorno parcial selecionado"><h4>Retorno selecionado</h4>
    <p>Dados declarados; não comprovam parada ou execução. Confira novamente antes de qualquer decisão.</p>
    {consulta.isFetching && <p role="status">Consultando retorno…</p>}
    {consulta.isError && <p role="alert">Retorno indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && item === null && <p>Retorno não encontrado neste Cliente.</p>}
    {!consulta.isFetching && !consulta.isError && item && <>
      <p>{item.descricao_restante} · {item.minutos_restantes} min · {item.estado} · revisão {item.revisao}.</p>
      <p>Pendência {item.pendencia_id} · Chamado {item.chamado_id} · parcela {item.parcela_id} · OS {item.os_id}.</p>
      {import.meta.env.VITE_SSO_HISTORICO_PROMOCAO_PARCIAL_ENABLED === "true" && <HistoricoPromocaoParcial key={`${userId}:${clienteId}:${item.id}`} userId={userId} clienteId={clienteId} retornoId={item.id}/>}
      {import.meta.env.VITE_SSO_PROMOCAO_CONTINUIDADE_ATOMICA_ENABLED === "true" && <PromoverContinuidadeAtomica
        key={`${userId}:${clienteId}:${item.id}`} userId={userId} clienteId={clienteId} retornoId={item.id} chamadoId={item.chamado_id}
        propostaId={item.proposta_id} revisao={item.revisao} descricaoRestante={item.descricao_restante} minutosRestantes={item.minutos_restantes} consultaDisponivel />}
    </>}
  </section>;
}
