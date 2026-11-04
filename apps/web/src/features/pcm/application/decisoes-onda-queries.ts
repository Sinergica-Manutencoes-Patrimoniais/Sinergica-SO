import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const item = z.object({ id: z.string().uuid(), atorId: z.string().uuid(), criadoEm: z.string().datetime({ offset: true }),
  revision: z.number().int().nonnegative(), versao: z.string().min(1).max(120), ambiente: z.string().min(1).max(120),
  ressalva: z.string().max(2000), referencias: z.record(z.string(), z.string()),
  evidencias: z.array(z.object({ cenario: z.string(), id: z.string().uuid(), revision: z.number().int().positive() }).strict()).max(30),
}).strict();
const pagina = z.object({ clienteId: z.string().uuid(), onda: z.number().int().min(1).max(6),
  revisionAtual: z.number().int().nonnegative(), itens: z.array(item).max(25) }).strict();
type Cursor = { antes: string | null; id: string | null };

export function useDecisoesOnda(userId: string, clienteId: string, onda: number) {
  return useInfiniteQuery({
    queryKey: ["sso-decisoes-onda", userId, clienteId, onda], gcTime: 0, refetchOnWindowFocus: true,
    initialPageParam: { antes: null, id: null } as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_decisoes_onda", {
        p_cliente_id: clienteId, p_onda: onda, p_antes: pageParam.antes, p_antes_id: pageParam.id, p_limite: 25,
      }).abortSignal(signal);
      if (error) throw error;
      const resposta = pagina.parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || resposta.clienteId !== clienteId || resposta.onda !== onda)
        throw new Error("Sessão ou contexto alterado.");
      return resposta;
    },
    getNextPageParam: (p): Cursor | undefined => p.itens.length === 25
      ? { antes: p.itens[p.itens.length - 1]!.criadoEm, id: p.itens[p.itens.length - 1]!.id } : undefined,
  });
}
