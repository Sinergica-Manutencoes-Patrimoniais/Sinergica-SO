import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z
  .object({
    plano_id: z.string().guid(),
    plano_nome: z.string(),
    plano_estado: z.string(),
    versao_id: z.string().guid(),
    versao_numero: z.number().int().positive(),
    versao_estado: z.enum(["rascunho", "aprovado"]),
    vigencia_inicio: z.string().nullable(),
    vigencia_fim: z.string().nullable(),
    rotina_id: z.string().guid(),
    rotina_nome: z.string(),
  })
  .strict();
type Props = {
  userId: string;
  clienteId: string;
  tipo: "sistema" | "componente" | "grupo";
  id: string;
};
type Cursor = { plano: string; versao: string; rotina: string };
export function PlanosDoAlvo(props: Props) {
  if (import.meta.env.VITE_SSO_PLANOS_POR_ALVO_ENABLED !== "true") return null;
  return (
    <Abrir key={JSON.stringify([props.userId, props.clienteId, props.tipo, props.id])} {...props} />
  );
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar Planos" : "Ver Planos deste ativo"}
      </button>
      {aberto && <Lista {...props} />}
    </section>
  );
}
function Lista({ userId, clienteId, tipo, id }: Props) {
  const q = useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, "planos-por-alvo", tipo, id],
    gcTime: 0,
    initialPageParam: null as Cursor | null,
    queryFn: async ({ pageParam, signal }) => {
      const conferir = async () => {
        const sessao = await supabase.auth.getUser();
        if (sessao.error || sessao.data.user?.id !== userId || signal.aborted)
          throw new Error("Sessão alterada.");
      };
      await conferir();
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_planos_por_alvo", {
          p_ator: userId,
          p_cliente: clienteId,
          p_tipo: tipo,
          p_alvo: id,
          p_apos_plano: pageParam?.plano ?? null,
          p_apos_versao: pageParam?.versao ?? null,
          p_apos_rotina: pageParam?.rotina ?? null,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(20).parse(data);
      let anterior = pageParam
        ? `${pageParam.plano}:${pageParam.versao}:${pageParam.rotina}`.toLowerCase()
        : "";
      for (const r of pagina) {
        const chave = `${r.plano_id}:${r.versao_id}:${r.rotina_id}`.toLowerCase();
        if (chave <= anterior) throw new Error("Página divergente.");
        anterior = chave;
      }
      await conferir();
      return pagina;
    },
    getNextPageParam: (pagina) => {
      const r = pagina.at(-1);
      return pagina.length === 20 && r
        ? { plano: r.plano_id, versao: r.versao_id, rotina: r.rotina_id }
        : undefined;
    },
  });
  const itens = q.data?.pages.flat() ?? [];
  const divergentes = itens.some((r, i) => {
    if (i === 0) return false;
    const anterior = itens[i - 1];
    return (
      !anterior ||
      `${r.plano_id}:${r.versao_id}:${r.rotina_id}`.toLowerCase() <=
        `${anterior.plano_id}:${anterior.versao_id}:${anterior.rotina_id}`.toLowerCase()
    );
  });
  return (
    <section aria-label="Planos do ativo">
      <p>
        Rascunhos e versões aprovadas são identificados separadamente. Vigência exibida não confirma
        execução ou cobertura; páginas não formam retrato transacional e não incluem Planos legados.
      </p>
      {q.isFetching && <output>Carregando Planos…</output>}
      {(q.isError || divergentes) && (
        <p role="alert">
          Planos indisponíveis, sem acesso ou histórico inconsistente.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!q.isFetching && !q.isError && !divergentes && q.data && (
        <>
          {itens.length === 0 ? (
            <p>Nenhum vínculo encontrado nesta fonte.</p>
          ) : (
            <ul>
              {itens.map((r) => (
                <li key={`${r.plano_id}:${r.versao_id}:${r.rotina_id}`}>
                  {r.plano_nome} · {r.plano_estado} · versão {r.versao_numero} ({r.versao_estado}) ·
                  Rotina {r.rotina_nome} · vigência {r.vigencia_inicio ?? "não informada"} a{" "}
                  {r.vigencia_fim ?? "sem fim informado"}
                </li>
              ))}
            </ul>
          )}
          {q.hasNextPage && (
            <button type="button" onClick={() => void q.fetchNextPage()}>
              Mais vínculos
            </button>
          )}
        </>
      )}
    </section>
  );
}
