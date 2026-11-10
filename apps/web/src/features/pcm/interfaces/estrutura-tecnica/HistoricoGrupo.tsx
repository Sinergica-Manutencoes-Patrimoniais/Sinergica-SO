import { useInfiniteQuery } from "@tanstack/react-query";
import { estruturaTecnicaQueryKeys } from "../../application/estrutura-tecnica-queries";
import { supabaseEstruturaTecnicaAdapter } from "../../infrastructure/supabase-estrutura-tecnica-adapter";
import { MotivoEventoGrupo } from "./MotivoEventoGrupo";

const nomesCampos: Record<string, string> = {
  nome: "Nome",
  quantidade: "Quantidade",
  local_id: "Local",
  area_id: "Área",
  parent_item_id: "Componente pai",
  categoria_id: "Categoria",
  sistema_id: "Sistema",
  caracteristicas: "Características",
  ativo: "Ativo",
};
function descrever(valor: unknown): string {
  if (valor == null) return "Não informado";
  if (typeof valor === "object")
    return (
      Object.entries(valor)
        .map(([nome, dado]) => `${nome}: ${String(dado)}`)
        .join(", ") || "Nenhuma"
    );
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}

function atributos(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {};
}

export function HistoricoGrupo({
  userId,
  clienteId,
  grupoId,
  tipo = "grupo",
}: { userId: string; clienteId: string; grupoId: string; tipo?: "grupo" | "componente" }) {
  const historico = useInfiniteQuery({
    queryKey: [...estruturaTecnicaQueryKeys.historico(userId, clienteId, grupoId), tipo],
    initialPageParam: null as { data: string; id: string } | null,
    queryFn: ({ pageParam, signal }) =>
      supabaseEstruturaTecnicaAdapter.listarHistorico(tipo, grupoId, 20, pageParam, signal),
    getNextPageParam: (ultima) => {
      const ultimo = ultima.at(-1);
      return ultima.length === 20 && ultimo ? { data: ultimo.data, id: ultimo.id } : undefined;
    },
    gcTime: 0,
  });
  if (historico.isPending || historico.isFetching)
    return <output>Carregando histórico…</output>;
  if (historico.isError)
    return (
      <div role="alert">
        Não foi possível carregar o histórico.{" "}
        <button type="button" onClick={() => void historico.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  const eventos = historico.data.pages.flat();
  return (
    <div>
      <p className="text-caption text-ink-3">
        Histórico disponível a partir da ativação deste recurso.
      </p>
      {eventos.length === 0 && <p>Nenhum evento disponível.</p>}
      <ol>
        {eventos.map((evento) => (
          <li key={evento.id}>
            <strong>
              {evento.acao === "grupo.criado"
                ? "Grupo criado"
                : evento.acao === "estrutura.movimentada"
                  ? "Estrutura alterada"
                  : "Grupo atualizado"}
            </strong>{" "}
            <time dateTime={evento.data}>{new Date(evento.data).toLocaleString("pt-BR")}</time>
            {tipo === "grupo" && <MotivoEventoGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} eventoId={evento.id} />}
            {evento.antes?.quantidade != null && evento.depois.quantidade != null && (
              <p>
                Quantidade: {String(evento.antes.quantidade)} para{" "}
                {String(evento.depois.quantidade)}
              </p>
            )}
            <details>
              <summary>Detalhes da alteração</summary>
              <dl>
                {Object.entries(nomesCampos)
                  .filter(
                    ([campo]) => campo !== "caracteristicas" &&
                      JSON.stringify(evento.antes?.[campo] ?? null) !==
                      JSON.stringify(evento.depois[campo] ?? null),
                  )
                  .map(([campo, rotulo]) => (
                    <div key={campo}>
                      <dt>{rotulo}</dt>
                      <dd>
                        {descrever(evento.antes?.[campo])} para {descrever(evento.depois[campo])}
                      </dd>
                    </div>
                  ))}
              </dl>
              {JSON.stringify(evento.antes?.caracteristicas ?? null) !== JSON.stringify(evento.depois.caracteristicas ?? null) && (
                <section aria-label="Alterações de características">
                  <h5>Características</h5>
                  <dl>
                    {[...new Set([...Object.keys(atributos(evento.antes?.caracteristicas)), ...Object.keys(atributos(evento.depois.caracteristicas))])].sort().filter((nome) =>
                      JSON.stringify(atributos(evento.antes?.caracteristicas)[nome] ?? null) !== JSON.stringify(atributos(evento.depois.caracteristicas)[nome] ?? null),
                    ).map((nome) => <div key={nome}><dt>{nome}</dt><dd>{descrever(atributos(evento.antes?.caracteristicas)[nome])} para {descrever(atributos(evento.depois.caracteristicas)[nome])}</dd></div>)}
                  </dl>
                </section>
              )}
            </details>
          </li>
        ))}
      </ol>
      {historico.hasNextPage && (
        <button
          type="button"
          disabled={historico.isFetchingNextPage}
          onClick={() => void historico.fetchNextPage()}
        >
          {historico.isFetchingNextPage ? "Carregando…" : "Carregar mais eventos"}
        </button>
      )}
    </div>
  );
}
