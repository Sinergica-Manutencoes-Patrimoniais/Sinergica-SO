import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const fotoSchema = z.object({ id: uuid, atestado_request_id: uuid, nota_id: uuid, revisao: z.number().int().positive(), mime_declarado: z.enum(["image/jpeg", "image/png"]), justificativa: z.string(), criado_em: z.string() }).strict();
export function useFotosGrupo(userId: string, clienteId: string, ocorrenciaId: string) {
  return useInfiniteQuery({ queryKey: ["fotos-atestado-grupo", userId, clienteId, ocorrenciaId], initialPageParam: null as number | null, gcTime: 0, retry: false, queryFn: async ({ pageParam, signal }) => {
    const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_listar_fotos_atestado_grupo_mediada", { p_cliente_id: clienteId, p_ocorrencia_id: ocorrenciaId, p_antes: pageParam, p_limite: 20 }).abortSignal(signal);
    if (error) throw error; const pagina = z.array(fotoSchema).max(20).parse(data); let anterior = pageParam ?? Number.POSITIVE_INFINITY;
    for (const item of pagina) { if (item.revisao >= anterior) throw new Error("Página divergente."); anterior = item.revisao; }
    const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return pagina;
  }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.revisao : undefined });
}
