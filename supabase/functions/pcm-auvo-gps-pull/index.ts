import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet, buildParamFilter } from "../_shared/auvo/client.ts";

interface AuvoGps { userId?: number; positionDate?: string; latitude?: number; longitude?: number; accuracy?: number; batteryLevel?: number; networkOperatorName?: string }
interface Response { result?: { entityList?: AuvoGps[] } }

export function mapGps(position: AuvoGps, funcionarioId: string | null): Record<string, unknown> | null {
  if (typeof position.userId !== "number" || typeof position.positionDate !== "string" || typeof position.latitude !== "number" || typeof position.longitude !== "number") return null;
  const date = new Date(position.positionDate);
  if (Number.isNaN(date.getTime())) return null;
  return { auvo_user_id: position.userId, funcionario_id: funcionarioId, position_date: date.toISOString(), latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy ?? null, battery_level: position.batteryLevel ?? null, network_operator_name: position.networkOperatorName ?? null };
}

if (import.meta.main) serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const response = await auvoGet<Response>(`/gps?${buildParamFilter({ getLastKnowPosition: true })}&page=1&pageSize=100&order=desc`);
    const positions = response.result?.entityList ?? [];
    const auvoIds = [...new Set(positions.map((p) => p.userId).filter((id): id is number => typeof id === "number"))];
    const { data: funcionarios, error: funcionariosError } = await db.schema("pcm").from("funcionarios").select("id,auvo_user_id").in("auvo_user_id", auvoIds);
    if (funcionariosError) throw funcionariosError;
    const ids = new Map((funcionarios ?? []).map((f) => [Number(f.auvo_user_id), String(f.id)]));
    const rows = positions.map((position) => mapGps(position, ids.get(position.userId ?? -1) ?? null)).filter((row): row is Record<string, unknown> => row != null);
    if (rows.length) {
      const { error } = await db.schema("pcm").from("gps_posicoes").upsert(rows, { onConflict: "auvo_user_id,position_date" });
      if (error) throw error;
    }
    const { data: purged, error: purgeError } = await db.schema("pcm").rpc("fn_purgar_gps_posicoes");
    if (purgeError) throw purgeError;
    return new Response(JSON.stringify({ ok: true, pulled: positions.length, upserted: rows.length, purged }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof AuvoApiError ? 502 : 500;
    console.error(JSON.stringify({ fn: "pcm-auvo-gps-pull", reqId, status, detail: String(error) }));
    return new Response(JSON.stringify({ type: "about:blank", title: "Erro", status, detail: status === 502 ? "Auvo indisponível ao consultar GPS" : "Não foi possível sincronizar GPS", reqId }), { status, headers: { "Content-Type": "application/problem+json", ...cors } });
  }
});
