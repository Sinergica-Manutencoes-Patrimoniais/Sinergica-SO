import { infiniteQueryOptions } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseListasMateriaisAdapter } from "../../infrastructure/supabase-listas-materiais-adapter";

const LIMITE = 20;

export function buscaOsCentralMateriaisOptions(usuario: string, cliente: string, busca: string) {
  return infiniteQueryOptions({
    queryKey: ["listas-materiais-central", usuario, cliente, "busca-os", busca],
    initialPageParam: null as string | null,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted) {
        throw new Error("Sessão alterada.");
      }
      const pagina = await supabaseListasMateriaisAdapter.buscarOsCentral(
        cliente,
        busca,
        LIMITE,
        pageParam,
        signal,
      );
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted) {
        throw new Error("Sessão alterada.");
      }
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === LIMITE ? pagina.at(-1)?.id : undefined),
  });
}
