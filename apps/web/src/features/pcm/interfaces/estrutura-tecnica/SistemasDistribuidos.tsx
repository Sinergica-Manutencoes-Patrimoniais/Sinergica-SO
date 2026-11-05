import { useInfiniteQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseEstruturaTecnicaAdapter } from "../../infrastructure/supabase-estrutura-tecnica-adapter";
import { PendenciasDoAlvo } from "../pendencias-tecnicas/PendenciasDoAlvo";
import { ResultadosDoAlvo } from "../pendencias-tecnicas/ResultadosAtivo";
import { FotosStagingAtivo } from "./FotosStagingAtivo";
import { FotosStagingGrupo } from "./FotosStagingGrupo";
import { FotosVerificadasGrupo } from "./FotosVerificadasGrupo";
import { HistoricoGrupo } from "./HistoricoGrupo";
import { PlanosDoAlvo } from "./PlanosDoAlvo";

/** Projeção de vínculos presentes: não interpreta ausência de vínculo como ausência física. */
export function SistemasDistribuidos({
  userId,
  clienteId,
  sistemaId,
}: { userId: string; clienteId: string; sistemaId?: string }) {
  if (import.meta.env.VITE_SSO_SISTEMAS_DISTRIBUIDOS_ENABLED !== "true") return null;
  return (
    <Conteudo
      key={`${userId}:${clienteId}:${sistemaId ?? "todos"}`}
      userId={userId}
      clienteId={clienteId}
      sistemaId={sistemaId}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  sistemaId,
}: { userId: string; clienteId: string; sistemaId?: string }) {
  async function conferirSessao(signal: AbortSignal) {
    const r = await supabase.auth.getUser();
    if (r.error || r.data.user?.id !== userId || signal.aborted)
      throw new Error("Sessão alterada.");
  }
  const sistemas = useInfiniteQuery({
    queryKey: [
      "estrutura-tecnica",
      userId,
      clienteId,
      "sistemas-distribuidos",
      sistemaId ?? "todos",
    ],
    gcTime: 0,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      let consulta = supabase
        .schema("pcm")
        .from("sistemas")
        .select("id,cliente_id,nome,ativo")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null);
      if (sistemaId) consulta = consulta.eq("id", sistemaId);
      const { data, error } = await consulta
        .order("id", { ascending: true })
        .range(pageParam, pageParam + 49)
        .abortSignal(signal);
      await conferirSessao(signal);
      if (error) throw error;
      return z
        .array(
          z.object({
            id: z.string().uuid(),
            cliente_id: z.string().uuid(),
            nome: z.string(),
            ativo: z.boolean(),
          }),
        )
        .max(50)
        .parse(data);
    },
    getNextPageParam: (pagina, paginas) => (pagina.length === 50 ? paginas.length * 50 : undefined),
  });
  const locais = useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, "locais-distribuidos"],
    gcTime: 0,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .from("locais")
        .select("id,nome,ativo,areas!inner(cliente_id)")
        .eq("areas.cliente_id", clienteId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(pageParam, pageParam + 49)
        .abortSignal(signal);
      await conferirSessao(signal);
      if (error) throw error;
      return z
        .array(z.object({ id: z.string().uuid(), nome: z.string(), ativo: z.boolean() }))
        .max(50)
        .parse(data);
    },
    getNextPageParam: (pagina, paginas) => (pagina.length === 50 ? paginas.length * 50 : undefined),
  });
  const itens = useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, "componentes-distribuidos"],
    gcTime: 0,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .from("equipamentos")
        .select("id,client_id,local_id,ativo,nome,tipo,identificador,parent_item_id")
        .eq("client_id", clienteId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(pageParam, pageParam + 49)
        .abortSignal(signal);
      await conferirSessao(signal);
      if (error) throw error;
      return z
        .array(
          z.object({
            id: z.string().uuid(),
            client_id: z.string().uuid().nullable(),
            local_id: z.string().uuid().nullable(),
            ativo: z.boolean(),
            nome: z.string().optional(),
            tipo: z.enum(["componente", "equipamento"]).optional(),
            identificador: z.string().nullable().optional(),
            parent_item_id: z.string().uuid().nullable(),
          }),
        )
        .max(50)
        .parse(data);
    },
    getNextPageParam: (pagina, paginas) => (pagina.length === 50 ? paginas.length * 50 : undefined),
  });
  const membros = useInfiniteQuery({
    queryKey: [
      "estrutura-tecnica",
      userId,
      clienteId,
      "vinculos-distribuidos",
      sistemaId ?? "todos",
    ],
    gcTime: 0,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      let consulta = supabase
        .schema("pcm")
        .from("sistema_itens")
        .select("sistema_id,item_id,sistemas!inner(cliente_id)")
        .eq("sistemas.cliente_id", clienteId);
      if (sistemaId) consulta = consulta.eq("sistema_id", sistemaId);
      const { data, error } = await consulta
        .order("sistema_id", { ascending: true })
        .order("item_id", { ascending: true })
        .range(pageParam, pageParam + 49)
        .abortSignal(signal);
      await conferirSessao(signal);
      if (error) throw error;
      return z
        .array(z.object({ sistema_id: z.string().uuid(), item_id: z.string().uuid() }))
        .max(50)
        .parse(data);
    },
    getNextPageParam: (pagina, paginas) => (pagina.length === 50 ? paginas.length * 50 : undefined),
  });
  const grupos = useInfiniteQuery({
    queryKey: [
      "estrutura-tecnica",
      userId,
      clienteId,
      "grupos-sistemas-distribuidos",
      sistemaId ?? "todos",
    ],
    gcTime: 0,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const pagina = await supabaseEstruturaTecnicaAdapter.listarGrupos(
        clienteId,
        pageParam,
        50,
        signal,
        sistemaId,
      );
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (pagina, paginas) => (pagina.length === 50 ? paginas.length * 50 : undefined),
  });
  const consultas = [sistemas, membros, itens, locais, grupos];
  const sistemasCarregados =
    !sistemas.isFetching && !sistemas.isError ? (sistemas.data?.pages.flat() ?? []) : [];
  const membrosCarregados =
    !membros.isFetching && !membros.isError ? (membros.data?.pages.flat() ?? []) : [];
  const itensCarregados =
    !itens.isFetching && !itens.isError ? (itens.data?.pages.flat() ?? []) : [];
  const locaisCarregados =
    !locais.isFetching && !locais.isError ? (locais.data?.pages.flat() ?? []) : [];
  const gruposCarregados =
    !grupos.isFetching && !grupos.isError ? (grupos.data?.pages.flat() ?? []) : [];
  return (
    <section aria-label="Sistemas distribuídos">
      <h3>{sistemaId ? "Locais e composição do Sistema" : "Sistemas distribuídos"}</h3>
      {consultas.some((q) => q.isPending || q.isFetching) && (
        <output>Carregando fontes de Sistemas…</output>
      )}
      {consultas.some((q) => q.isError) && (
        <p role="alert">
          Uma ou mais fontes estão indisponíveis. As demais permanecem visíveis, mas a cobertura é
          incompleta.{" "}
          <button
            type="button"
            onClick={() => {
              for (const q of consultas) if (q.isError) void q.refetch();
            }}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <p>
        Locais derivados de vínculos carregados de Componentes, Equipamentos e Grupos deste Cliente.
        A paginação não cria retrato transacional e ausência de vínculo não comprova ausência física
        nem completude.
      </p>
      {(consultas.some((q) => q.isPending || q.isFetching || q.isError) ||
        grupos.hasNextPage ||
        itens.hasNextPage ||
        membros.hasNextPage ||
        sistemas.hasNextPage ||
        locais.hasNextPage) && (
        <p role="alert">Há páginas de dados não carregadas; a cobertura exibida é incompleta.</p>
      )}
      {sistemasCarregados
        .filter((s) => s.cliente_id === clienteId && s.ativo)
        .map((s) => {
          const vinculados = membrosCarregados.filter((m) => m.sistema_id === s.id);
          const gruposSistema = gruposCarregados.filter(
            (g) => g.clienteId === clienteId && g.sistemaId === s.id,
          );
          const cobertura = new Map<string, { nome: string; itens: number; grupos: number }>();
          let indeterminados = 0;
          for (const membro of vinculados) {
            const item = itensCarregados.find(
              (i) => i.id === membro.item_id && i.client_id === clienteId && i.ativo,
            );
            const local = item?.local_id
              ? locaisCarregados.find((l) => l.id === item.local_id && l.ativo)
              : undefined;
            if (!local) {
              indeterminados++;
              continue;
            }
            const anterior = cobertura.get(local.id);
            cobertura.set(local.id, {
              nome: local.nome,
              itens: (anterior?.itens ?? 0) + 1,
              grupos: anterior?.grupos ?? 0,
            });
          }
          for (const grupo of gruposSistema) {
            const local = locaisCarregados.find((l) => l.id === grupo.localId && l.ativo);
            if (!local) {
              indeterminados++;
              continue;
            }
            const anterior = cobertura.get(local.id);
            cobertura.set(local.id, {
              nome: local.nome,
              itens: anterior?.itens ?? 0,
              grupos: (anterior?.grupos ?? 0) + 1,
            });
          }
          return (
            <details key={s.id}>
              <summary>
                {s.nome} · {cobertura.size} Local(is) identificados
              </summary>
              <ResultadosDoAlvo
                userId={userId}
                clienteId={clienteId}
                tipo="sistema"
                id={s.id}
                nome={s.nome}
              />
              {vinculados.length > 0 && (
                <section aria-label={`Componentes e Equipamentos de ${s.nome}`}>
                  <h4>Componentes e Equipamentos carregados</h4>
                  <ArvoreMembros
                    userId={userId}
                    clienteId={clienteId}
                    membros={vinculados}
                    itens={itensCarregados}
                    locais={locaisCarregados}
                  />
                </section>
              )}
              {gruposSistema.length > 0 && (
                <section aria-label={`Grupos de ${s.nome}`}>
                  <h4>Grupos carregados</h4>
                  <ul>
                    {gruposSistema.map((g) => (
                      <li key={g.id}>
                        {g.nome} · {g.quantidade} unidades ·{" "}
                        {locaisCarregados.find((l) => l.id === g.localId && l.ativo)?.nome ??
                          "Local não identificado nas páginas carregadas"}
                        <DetalheGrupoSistema
                          userId={userId}
                          clienteId={clienteId}
                          grupoId={g.id}
                          nome={g.nome}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {cobertura.size > 0 && (
                <ul>
                  {Array.from(cobertura.entries()).map(([id, g]) => (
                    <li key={id}>
                      {g.nome} · {g.itens} vínculo(s) de Componentes/Equipamentos · {g.grupos}{" "}
                      Grupo(s)
                    </li>
                  ))}
                </ul>
              )}
              {indeterminados > 0 && (
                <p role="alert">
                  {indeterminados} vínculo(s) sem Local válido nos dados carregados; localização
                  indeterminada.
                </p>
              )}
              {!membros.isPending &&
                !membros.isFetching &&
                !membros.isError &&
                !grupos.isPending &&
                !grupos.isFetching &&
                !grupos.isError &&
                vinculados.length === 0 &&
                gruposSistema.length === 0 && (
                  <p>Nenhum vínculo carregado; não conclui que o Sistema esteja sem ativos.</p>
                )}
            </details>
          );
        })}
      {sistemas.hasNextPage && (
        <button
          type="button"
          disabled={sistemas.isFetchingNextPage}
          onClick={() => void sistemas.fetchNextPage()}
        >
          Carregar mais Sistemas
        </button>
      )}
      {locais.hasNextPage && (
        <button
          type="button"
          disabled={locais.isFetchingNextPage}
          onClick={() => void locais.fetchNextPage()}
        >
          Carregar mais Locais
        </button>
      )}
      {itens.hasNextPage && (
        <button
          type="button"
          disabled={itens.isFetchingNextPage}
          onClick={() => void itens.fetchNextPage()}
        >
          Carregar mais Componentes e Equipamentos
        </button>
      )}
      {membros.hasNextPage && (
        <button
          type="button"
          disabled={membros.isFetchingNextPage}
          onClick={() => void membros.fetchNextPage()}
        >
          Carregar mais vínculos
        </button>
      )}
      {grupos.hasNextPage && (
        <button
          type="button"
          disabled={grupos.isFetchingNextPage}
          onClick={() => void grupos.fetchNextPage()}
        >
          Carregar mais Grupos
        </button>
      )}
    </section>
  );
}

type ItemDistribuido = {
  id: string;
  client_id: string | null;
  local_id: string | null;
  ativo: boolean;
  nome?: string;
  tipo?: "componente" | "equipamento";
  identificador?: string | null;
  parent_item_id: string | null;
};

/** Árvore restrita aos vínculos carregados; pais externos não são inferidos. */
function ArvoreMembros({
  userId,
  clienteId,
  membros,
  itens,
  locais,
}: {
  userId: string;
  clienteId: string;
  membros: { item_id: string }[];
  itens: ItemDistribuido[];
  locais: { id: string; nome: string; ativo: boolean }[];
}) {
  const ids = [...new Set(membros.map((m) => m.item_id))];
  const porId = new Map(
    itens.filter((i) => i.client_id === clienteId && i.ativo).map((i) => [i.id, i]),
  );
  const idsCarregados = new Set(ids);
  const filhos = new Map<string, string[]>();
  const raizes: string[] = [];
  for (const id of ids) {
    const pai = porId.get(id)?.parent_item_id;
    if (!pai || !idsCarregados.has(pai)) raizes.push(id);
    else filhos.set(pai, [...(filhos.get(pai) ?? []), id]);
  }
  const exibidos = new Set<string>();
  const renderizar = (id: string): ReactNode => {
    if (exibidos.has(id)) return null;
    exibidos.add(id);
    const item = porId.get(id);
    const local = item?.local_id
      ? locais.find((l) => l.id === item.local_id && l.ativo)
      : undefined;
    const descendentes = (filhos.get(id) ?? []).filter((filho) => !exibidos.has(filho));
    return (
      <li key={id}>
        {item ? (
          <>
            {item.tipo === "componente"
              ? "Componente"
              : item.tipo === "equipamento"
                ? "Equipamento"
                : "Item"}{" "}
            {item.nome ?? item.id} · identificador {item.identificador || "não informado"} · Local{" "}
            {local?.nome ?? "não identificado nas páginas carregadas"}
            {item.parent_item_id && !idsCarregados.has(item.parent_item_id) && (
              <p>
                Item superior {item.parent_item_id} não está entre os vínculos carregados deste
                Sistema.
              </p>
            )}
            <DetalheMembro
              userId={userId}
              clienteId={clienteId}
              itemId={item.id}
              nome={item.nome ?? item.id}
              tipo={item.tipo}
            />
          </>
        ) : (
          <>Item {id} não identificado nas páginas carregadas; confira o vínculo.</>
        )}
        {descendentes.length > 0 && <ul>{descendentes.map(renderizar)}</ul>}
      </li>
    );
  };
  const arvore = raizes.map(renderizar);
  const semRaiz = ids.filter((id) => !exibidos.has(id));
  return (
    <>
      <p>
        Hierarquia apenas dos vínculos e itens carregados; pais ausentes podem estar em outra
        página.
      </p>
      <ul>{arvore}</ul>
      {semRaiz.length > 0 && (
        <>
          <p role="alert">Há vínculos sem raiz identificável ou com ciclo; confira a composição.</p>
          <ul>{semRaiz.map(renderizar)}</ul>
        </>
      )}
    </>
  );
}

function DetalheMembro({
  userId,
  clienteId,
  itemId,
  nome,
  tipo,
}: {
  userId: string;
  clienteId: string;
  itemId: string;
  nome: string;
  tipo?: "componente" | "equipamento";
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button
        type="button"
        aria-expanded={aberto}
        aria-label={`${aberto ? "Ocultar" : "Ver"} histórico de ${nome}`}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? "Ocultar histórico" : "Ver histórico"}
      </button>
      {aberto && (
        <>
          <HistoricoGrupo
            tipo="componente"
            userId={userId}
            clienteId={clienteId}
            grupoId={itemId}
          />
          {tipo && (
            <ResultadosDoAlvo
              userId={userId}
              clienteId={clienteId}
              tipo="componente"
              id={itemId}
              nome={nome}
            />
          )}
          {tipo && (
            <PendenciasDoAlvo userId={userId} clienteId={clienteId} tipo="componente" id={itemId} />
          )}
          {tipo && (
            <FotosStagingAtivo
              userId={userId}
              clienteId={clienteId}
              tipo={tipo}
              entidadeId={itemId}
            />
          )}
          {!tipo && (
            <p>Tipo do cadastro não disponível nas páginas carregadas; fotos não consultadas.</p>
          )}
        </>
      )}
    </section>
  );
}

function DetalheGrupoSistema({
  userId,
  clienteId,
  grupoId,
  nome,
}: { userId: string; clienteId: string; grupoId: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button
        type="button"
        aria-expanded={aberto}
        aria-label={`${aberto ? "Ocultar" : "Ver"} detalhes do Grupo ${nome}`}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? "Ocultar detalhes" : "Ver detalhes do Grupo"}
      </button>
      {aberto && (
        <>
          <HistoricoGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} />
          <ResultadosDoAlvo
            userId={userId}
            clienteId={clienteId}
            tipo="grupo"
            id={grupoId}
            nome={nome}
          />
          <PlanosDoAlvo userId={userId} clienteId={clienteId} tipo="grupo" id={grupoId} />
          <PendenciasDoAlvo userId={userId} clienteId={clienteId} tipo="grupo" id={grupoId} />
          <FotosStagingGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} />
          <FotosVerificadasGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} />
        </>
      )}
    </section>
  );
}
