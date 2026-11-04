import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const itemSchema = z.object({
  id: z.string().uuid(), revision: z.number().int().positive(), cenario: z.string().regex(/^CT-(00[1-9]|0[12][0-9]|030)$/),
  versao: z.string().min(1).max(120), ambiente: z.string().min(1).max(120), executorId: z.string().uuid(),
  executadoEm: z.string().datetime({offset:true}), resultado: z.enum(["passou", "falhou", "bloqueado"]),
  identificadores: z.array(z.string()).min(1).max(50), artefatos: z.array(z.string()).min(1).max(50), ressalva: z.string().max(2000),
}).strict();
const paginaSchema = z.object({
  clienteId: z.string().uuid(), onda: z.number().int().min(1).max(6), revision: z.number().int().nonnegative(),
  itens: z.array(itemSchema).max(50),
}).strict();
type Cursor = { apos: number | null; revision: number | null };

export function useEvidenciasOnda(userId: string, clienteId: string, onda: number) {
  return useInfiniteQuery({
    queryKey: ["sso-evidencias-onda", userId, clienteId, onda],
    initialPageParam: { apos: null, revision: null } as Cursor,
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_evidencias_onda", {
        p_cliente_id: clienteId, p_onda: onda, p_apos: pageParam.apos, p_revisao: pageParam.revision, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = paginaSchema.parse(data);
      if (pagina.clienteId !== clienteId || pagina.onda !== onda || (pageParam.revision !== null && pagina.revision !== pageParam.revision)) {
        throw new Error("Fotografia de evidências divergente.");
      }
      let anterior = pageParam.apos ?? 0;
      for (const item of pagina.itens) {
        if (item.revision <= anterior || item.revision > pagina.revision) throw new Error("Paginação de evidências inválida.");
        anterior = item.revision;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina): Cursor | undefined => pagina.itens.length === 50
      ? { apos: pagina.itens[pagina.itens.length - 1]!.revision, revision: pagina.revision }
      : undefined,
  });
}
