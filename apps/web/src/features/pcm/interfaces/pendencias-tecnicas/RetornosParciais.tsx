import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { PromoverRetornoParcial } from "./PromoverRetornoParcial";
import { ConfirmarContinuacaoDevolvida } from "./ConfirmarContinuacaoDevolvida";
import { PromoverContinuidadeAtomica } from "./PromoverContinuidadeAtomica";
import { RecuperarPromocaoParcial } from "./RecuperarPromocaoParcial";

const id = z.string().guid();
const linha = z.object({ id, ciclo_id: id, pendencia_id: id, composicao_id: id, chamado_id: id, parcela_id: id, os_id: id, proposta_id: id,
  descricao_restante: z.string().min(1).max(4000), minutos_restantes: z.number().int().positive(), estado: z.enum(["aguardando", "promovido"]),
  revisao: z.number().int().positive(), criado_em: z.string().datetime({ offset: true }) }).strict();

export function RetornosParciais({ userId, clienteId, destaqueId }: { userId: string; clienteId: string; destaqueId?: string | null }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [atomicoSelecionado, setAtomicoSelecionado] = useState<string | null>(null);
  const consulta = useInfiniteQuery({ queryKey: ["backlog-retornos-parciais", userId, clienteId], initialPageParam: null as string | null,
    gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_retornos_parciais", { p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linha).max(50).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.id <= anterior) throw new Error("Página divergente"); anterior = item.id; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada");
      return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.id : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Retornos parciais experimentais">
    <h4>Retornos parciais experimentais</h4>
    <p>Restantes declarados, separados da fila oficial. Não comprovam cobertura ou parada remota; dados podem mudar entre páginas.</p>
    {destaqueId && !itens.some((item) => item.id === destaqueId) && <p role="status">Retorno selecionado {destaqueId} ainda não consta nas páginas carregadas. Consulte mais páginas ou atualize a lista.</p>}
    {consulta.isFetching && <p role="status">Consultando retornos parciais…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && <div hidden={consulta.isFetching || consulta.isError}>{itens.length === 0 ? <p>Nenhum retorno parcial encontrado.</p> : <ol>{itens.map((item) => <li key={item.id}>
      {item.id === destaqueId && <strong>Selecionado no ranking. </strong>}<strong>{item.descricao_restante}</strong> · {item.minutos_restantes} min · {item.estado} · revisão {item.revisao}.
      <p>Pendência {item.pendencia_id} · Chamado anterior {item.chamado_id} · parcela {item.parcela_id} · OS {item.os_id} · proposta {item.proposta_id}.</p>
      {item.estado === "promovido" && <ConfirmarContinuacaoDevolvida userId={userId} clienteId={clienteId} retornoId={item.id} chamadoId={item.chamado_id} propostaId={item.proposta_id} />}
      {import.meta.env.VITE_SSO_PROMOCAO_CONTINUIDADE_ATOMICA_ENABLED === "true" && <>
        <button type="button" aria-expanded={atomicoSelecionado === item.id} onClick={() => setAtomicoSelecionado(atomicoSelecionado === item.id ? null : item.id)}>{atomicoSelecionado === item.id ? "Fechar promoção atômica" : "Abrir promoção atômica ou recuperar pedido"}</button>
        {atomicoSelecionado === item.id && <PromoverContinuidadeAtomica key={`${userId}:${clienteId}:${item.id}`} userId={userId} clienteId={clienteId} retornoId={item.id} chamadoId={item.chamado_id} propostaId={item.proposta_id} revisao={item.revisao} descricaoRestante={item.descricao_restante} minutosRestantes={item.minutos_restantes} consultaDisponivel={!consulta.isFetching && !consulta.isError} />}
      </>}
      {import.meta.env.VITE_SSO_PROMOCAO_RETORNO_PARCIAL_ENABLED === "true" && <><button type="button" aria-expanded={selecionado === item.id} onClick={() => setSelecionado(selecionado === item.id ? null : item.id)}>{selecionado === item.id ? "Fechar promoção" : "Abrir promoção ou recuperar pedido"}</button>
        {selecionado === item.id && <PromoverRetornoParcial key={`${userId}:${clienteId}:${item.id}`} userId={userId} clienteId={clienteId} retornoId={item.id} revisao={item.revisao} estado={item.estado} descricaoRestante={item.descricao_restante} minutosRestantes={item.minutos_restantes} consultaDisponivel={!consulta.isFetching && !consulta.isError} />}</>}
    </li>)}</ol>}</div>}
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais retornos parciais</button>}
    {import.meta.env.VITE_SSO_CONSULTA_PROMOCAO_PARCIAL_ENABLED === "true" && <RecuperarPromocaoParcial userId={userId} clienteId={clienteId} retornosCarregados={itens.map((item) => item.id)} />}
  </section>;
}
