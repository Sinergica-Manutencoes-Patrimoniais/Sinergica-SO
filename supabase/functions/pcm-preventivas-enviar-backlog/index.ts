// A decisão de transformar uma resposta em backlog é sempre humana e idempotente.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";

const Input = z.object({ avaliacaoId: z.string().uuid(), descricao: z.string().trim().min(3).max(2000) });
function escrita(req: Request): boolean { try { const p = (req.headers.get("Authorization")?.replace("Bearer ", "") ?? "").split(".")[1]; const c = JSON.parse(atob((p ?? "").replace(/-/g, "+").replace(/_/g, "/"))); return c.user_role === "superadmin" || c.user_modulos?.pcm === "escrita"; } catch { return false; } }

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    const { userId } = await requireAuth(req);
    if (!escrita(req)) throw new HttpError(403, "Sem permissão de escrita no PCM");
    const input = Input.parse(await req.json());
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", getSupabaseServiceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existente, error: existenteErro } = await db.schema("pcm").from("achados_preventivos").select("backlog_os_id").eq("avaliacao_id", input.avaliacaoId).eq("chave_origem", "decisao-manual").maybeSingle();
    if (existenteErro) throw existenteErro;
    if (existente?.backlog_os_id) return resposta(200, { ok: true, osId: existente.backlog_os_id, created: false }, cors);
    const { data: avaliacao, error: avaliacaoErro } = await db.schema("pcm").from("avaliacoes_preventivas").select("id,ocorrencia_id,item_referencia,local_informado,resposta").eq("id", input.avaliacaoId).single();
    if (avaliacaoErro) throw avaliacaoErro;
    const { data: ocorrencia, error: ocorrenciaErro } = await db.schema("pcm").from("ocorrencias_preventivas").select("plano_id").eq("id", avaliacao.ocorrencia_id).single();
    if (ocorrenciaErro) throw ocorrenciaErro;
    const { data: plano, error: planoErro } = await db.schema("pcm").from("planos_preventivos").select("cliente_id,sistema_id,equipamento_id").eq("id", ocorrencia.plano_id).single();
    if (planoErro) throw planoErro;
    const { data: achado, error: achadoErro } = await db.schema("pcm").from("achados_preventivos").upsert({ avaliacao_id: avaliacao.id, chave_origem: "decisao-manual", descricao: input.descricao, decisao: "pendente" }, { onConflict: "avaliacao_id,chave_origem" }).select("id,backlog_os_id").single();
    if (achadoErro) throw achadoErro;
    if (achado.backlog_os_id) return resposta(200, { ok: true, osId: achado.backlog_os_id, created: false }, cors);
    const local = [avaliacao.local_informado, avaliacao.item_referencia].filter(Boolean).join(" · ") || null;
    const { data: os, error: osErro } = await db.schema("pcm").from("ordens_servico").insert({ client_id: plano.cliente_id, titulo: `Achado preventivo: ${input.descricao.slice(0, 120)}`, descricao: input.descricao, categoria: "corretiva", status: "solicitacao", prioridade: "normal", origem: "preventiva_achado", local_descricao: local, created_by: userId, sistema_id: plano.sistema_id, equipamento_id: plano.equipamento_id }).select("id").single();
    if (osErro) throw osErro;
    const { error: atualizarErro } = await db.schema("pcm").from("achados_preventivos").update({ decisao: "backlog", backlog_os_id: os.id, decidido_em: new Date().toISOString(), decidido_por: userId }).eq("id", achado.id);
    if (atualizarErro) throw atualizarErro;
    return resposta(201, { ok: true, osId: os.id, created: true }, cors);
  } catch (erro) {
    const status = erro instanceof HttpError ? erro.status : erro instanceof z.ZodError ? 422 : 500;
    const detail = erro instanceof HttpError ? erro.message : erro instanceof z.ZodError ? "Entrada inválida" : "Não foi possível enviar o achado ao backlog";
    return resposta(status, { title: "Error", status, detail }, cors);
  }
});
function resposta(status: number, body: unknown, cors: Record<string, string>): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } }); }
