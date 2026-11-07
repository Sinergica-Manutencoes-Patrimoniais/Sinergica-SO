import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase-client";

type Ordem = { id: string; numero: string; titulo: string; status: string };
type Leitura = {
  listar(
    cliente: string,
    chamado: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ): Promise<Ordem[]>;
};

export const chamadosOsQueryKeys = {
  ordens: (usuario: string, cliente: string, chamado: string) =>
    ["ordens-chamado", usuario, cliente, chamado] as const,
};

// A integração depende da disponibilidade e autorização da RPC 0312.
export function useOrdensDoChamado(
  leitura: Leitura,
  usuario: string,
  cliente: string,
  chamado: string,
) {
  const consulta = useInfiniteQuery({
    queryKey: chamadosOsQueryKeys.ordens(usuario, cliente, chamado),
    enabled: Boolean(usuario && cliente && chamado),
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      signal.throwIfAborted();
      const ordens = await leitura.listar(cliente, chamado, 20, pageParam, signal);
      const depois = await supabase.auth.getUser();
      signal.throwIfAborted();
      if (depois.error || depois.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      return ordens;
    },
    getNextPageParam: (ultima) =>
      ultima.length === 20 ? ultima[ultima.length - 1]?.id : undefined,
  });
  // Dados mantidos pelo cache não comprovam autorização após uma reconsulta.
  // O servidor continua sendo responsável pela autorização de cada página.
  return {
    ...consulta,
    data: consulta.isError || consulta.isRefetching ? undefined : consulta.data,
  };
}
