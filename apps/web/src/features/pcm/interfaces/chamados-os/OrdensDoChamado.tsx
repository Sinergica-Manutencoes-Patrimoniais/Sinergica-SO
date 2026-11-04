import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { useOrdensDoChamado } from "../../application/chamados-os-queries";
import { carregarResumosChamados } from "../../application/resumos-chamados-lote";
import { resumirProgressoChamado } from "../../domain/progresso-chamado";
import { OrdensChamadoFotografia } from "./OrdensChamadoFotografia";
import { MateriaisDaOrdem } from "./MateriaisDaOrdem";

type Leitura = {
  listar(
    cliente: string,
    chamado: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<{ id: string; numero: string; titulo: string; status: string }[]>;
};
type Props = { usuario: string; cliente: string; chamado: string; leitura: Leitura; onAbrirOs?: (id: string) => void };
export function OrdensDoChamado(props: Props) {
  if (import.meta.env.VITE_SSO_OS_CHAMADO_FOTOGRAFIA_ENABLED === "true") return <OrdensChamadoFotografia
    key={`${props.usuario}:${props.cliente}:${props.chamado}`} usuario={props.usuario} cliente={props.cliente} chamado={props.chamado} onAbrirOs={props.onAbrirOs} />;
  return <OrdensLegadas {...props} />;
}
function OrdensLegadas({ usuario, cliente, chamado, leitura, onAbrirOs }: Props) {
  const consulta = useOrdensDoChamado(leitura, usuario, cliente, chamado);
  const maisDeUmaPagina = (consulta.data?.pages.length ?? 0) > 1;
  const resumoServidor = useQuery({
    queryKey: ["s167-resumo-chamados", usuario, cliente, chamado],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      const resultado = await carregarResumosChamados([chamado], signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    },
    enabled: import.meta.env.VITE_SSO_RESUMO_CHAMADOS_ENABLED === "true" && maisDeUmaPagina && !consulta.isFetching && !consulta.isError,
    staleTime: 0,
    refetchInterval: 30000,
  });
  const ordens = consulta.data?.pages.flat() ?? [];
  const completa =
    !consulta.isFetching && !consulta.isError && !!consulta.data && !consulta.hasNextPage && consulta.data.pages.length === 1;
  const progressoLocal = resumirProgressoChamado(
    ordens.map((os) => os.status),
    completa,
  );
  const progresso = import.meta.env.VITE_SSO_RESUMO_CHAMADOS_ENABLED === "true" && maisDeUmaPagina && !consulta.isFetching && !consulta.isError && !resumoServidor.isFetching && !resumoServidor.isError
    ? resumoServidor.data?.[chamado] ?? null : progressoLocal;
  return (
    <section className="border-t border-line-soft px-4 py-3">
      <h3 className="font-semibold">Ordens de Serviço vinculadas</h3>
      {progresso && (
        <p>
          {progresso.finalizadas} de {progresso.total} OS finalizadas
          {progresso.etapasMistas && " · Em andamento"}
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.hasNextPage && (
        <p>Carregue mais OS para consultar a lista.</p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data && !consulta.hasNextPage && maisDeUmaPagina && !progresso && (
        <p>Lista paginada: contagem integral indisponível sem fotografia única.</p>
      )}
      {consulta.isFetching && <output>Consultando Ordens de Serviço…</output>}
      {consulta.isError && (
        <div role="alert">
          Não foi possível carregar as Ordens de Serviço.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && (
        <p>Nenhuma Ordem de Serviço vinculada.</p>
      )}
      {!consulta.isFetching && !consulta.isError && (
        <ul>
          {ordens.map((os) => (
            <li key={os.id}>
              {os.numero} · {os.titulo} · {os.status}
              {onAbrirOs && <button type="button" onClick={() => onAbrirOs(os.id)}>Abrir OS {os.numero}</button>}
              <MateriaisDaOrdem usuario={usuario} cliente={cliente} ordem={os.id} numero={os.numero} />
            </li>
          ))}
        </ul>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.hasNextPage && (
        <button type="button" onClick={() => void consulta.fetchNextPage()}>
          Carregar mais Ordens de Serviço
        </button>
      )}
    </section>
  );
}
export function EntradaOrdensChamado({
  habilitado,
  chamadoEsperado,
  ...props
}: Props & { habilitado: string | undefined; chamadoEsperado: string }) {
  if (habilitado !== "true" || props.chamado !== chamadoEsperado) return null;
  return <OrdensDoChamado {...props} />;
}
