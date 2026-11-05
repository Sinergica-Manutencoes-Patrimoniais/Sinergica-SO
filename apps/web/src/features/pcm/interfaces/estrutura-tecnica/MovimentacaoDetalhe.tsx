import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { moverComponente } from "../../application/estrutura-tecnica";
import type { EquipamentoItem } from "../../domain/equipamentos";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseEstruturaTecnicaAdapter } from "../../infrastructure/supabase-estrutura-tecnica-adapter";
import { MovimentarComponente } from "./MovimentarComponente";

async function conferirSessao(userId: string, signal?: AbortSignal) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
}

function useDestinos(
  userId: string,
  clienteId: string,
  tipo: "area" | "local" | "componente",
  busca: string,
  habilitado: boolean,
) {
  return useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, "destinos", tipo, busca],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(userId, signal);
      const destinos = await supabaseEstruturaTecnicaAdapter.listarDestinos(
        clienteId,
        tipo,
        20,
        pageParam,
        busca || null,
        signal,
      );
      await conferirSessao(userId, signal);
      return destinos;
    },
    getNextPageParam: (ultima) => (ultima.length === 20 ? ultima.at(-1)?.id : undefined),
    placeholderData: (dados, anterior) =>
      anterior?.queryKey[1] === userId &&
      anterior.queryKey[2] === clienteId &&
      anterior.queryKey[4] === tipo
        ? dados
        : undefined,
    enabled: habilitado,
    gcTime: 0,
  });
}

type MovimentacaoDetalheProps = {
  userId: string;
  clienteId: string;
  item: Pick<EquipamentoItem, "id" | "estruturaRevisao" | "areaId" | "localId" | "parentItemId">;
  onConcluido: () => void;
};

export function MovimentacaoDetalhe(props: MovimentacaoDetalheProps) {
  return (
    <MovimentacaoContexto
      key={JSON.stringify([props.userId, props.clienteId, props.item.id])}
      {...props}
    />
  );
}

function MovimentacaoContexto({ userId, clienteId, item, onConcluido }: MovimentacaoDetalheProps) {
  const [aberto, setAberto] = useState(false);
  const [buscaArea, setBuscaArea] = useState("");
  const [buscaLocal, setBuscaLocal] = useState("");
  const [buscaPai, setBuscaPai] = useState("");
  const queryClient = useQueryClient();
  const permissao = useQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, "pode-movimentar"],
    queryFn: async ({ signal }) => {
      await conferirSessao(userId, signal);
      const permitido = await supabaseCapacidadesSsoAdapter.autorizarAcao(
        "cadastro.gerir",
        clienteId,
      );
      await conferirSessao(userId, signal);
      return permitido;
    },
    gcTime: 0,
  });
  const habilitado =
    aberto && permissao.data === true && !permissao.isFetching && !permissao.isError;
  const areas = useDestinos(userId, clienteId, "area", buscaArea, habilitado);
  const locais = useDestinos(userId, clienteId, "local", buscaLocal, habilitado);
  const pais = useDestinos(userId, clienteId, "componente", buscaPai, habilitado);
  const consultas = [areas, locais, pais];
  const anteriores = useRef<{
    areas: typeof areas.data;
    locais: typeof locais.data;
    pais: typeof pais.data;
  }>({ areas: undefined, locais: undefined, pais: undefined });
  if (areas.data && !areas.isPlaceholderData && !areas.isError)
    anteriores.current.areas = areas.data;
  if (locais.data && !locais.isPlaceholderData && !locais.isError)
    anteriores.current.locais = locais.data;
  if (pais.data && !pais.isPlaceholderData && !pais.isError) anteriores.current.pais = pais.data;
  const dadosAreas = areas.data ?? anteriores.current.areas;
  const dadosLocais = locais.data ?? anteriores.current.locais;
  const dadosPais = pais.data ?? anteriores.current.pais;
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando permissão de movimentação…</output>;
  if (permissao.isError)
    return (
      <div role="alert">
        Não foi possível verificar permissão.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  if (!permissao.data) return null;
  return (
    <div>
      <button type="button" onClick={() => setAberto((atual) => !atual)}>
        {aberto ? "Fechar movimentação" : "Movimentar Componente"}
      </button>
      {aberto && consultas.some((q) => q.isPending) && <output>Carregando destinos…</output>}
      {aberto && consultas.some((q) => q.isError) && (
        <div role="alert">
          Não foi possível carregar destinos.{" "}
          <button
            type="button"
            onClick={() => {
              for (const consulta of consultas) if (consulta.isError) void consulta.refetch();
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {aberto && dadosAreas && dadosLocais && dadosPais && (
        <>
          <label>
            Buscar Áreas
            <input
              className="input"
              maxLength={120}
              value={buscaArea}
              onChange={(e) => setBuscaArea(e.target.value)}
            />
          </label>
          <label>
            Buscar Locais
            <input
              className="input"
              maxLength={120}
              value={buscaLocal}
              onChange={(e) => setBuscaLocal(e.target.value)}
            />
          </label>
          <label>
            Buscar Componentes
            <input
              className="input"
              maxLength={120}
              value={buscaPai}
              onChange={(e) => setBuscaPai(e.target.value)}
            />
          </label>
          {areas.hasNextPage && (
            <button
              type="button"
              disabled={areas.isFetching || areas.isPlaceholderData}
              onClick={() => void areas.fetchNextPage()}
            >
              Mais Áreas
            </button>
          )}
          {locais.hasNextPage && (
            <button
              type="button"
              disabled={locais.isFetching || locais.isPlaceholderData}
              onClick={() => void locais.fetchNextPage()}
            >
              Mais Locais
            </button>
          )}
          {pais.hasNextPage && (
            <button
              type="button"
              disabled={pais.isFetching || pais.isPlaceholderData}
              onClick={() => void pais.fetchNextPage()}
            >
              Mais Componentes
            </button>
          )}
          <fieldset
            hidden={consultas.some((q) => q.isError || q.isFetching || q.isPlaceholderData)}
            disabled={consultas.some((q) => q.isError || q.isFetching || q.isPlaceholderData)}
          >
            <MovimentarComponente
              userId={userId}
              clienteId={clienteId}
              item={item}
              areas={dadosAreas.pages.flat()}
              locais={dadosLocais.pages
                .flat()
                .filter((l): l is typeof l & { areaId: string } => l.areaId !== null)}
              pais={dadosPais.pages.flat()}
              enviar={(comando) => moverComponente(supabaseEstruturaTecnicaAdapter, comando)}
              onConcluido={() => {
                setAberto(false);
                void queryClient.invalidateQueries({
                  queryKey: ["estrutura-tecnica", userId, clienteId, "historico", item.id],
                });
                onConcluido();
              }}
            />
          </fieldset>
        </>
      )}
    </div>
  );
}
