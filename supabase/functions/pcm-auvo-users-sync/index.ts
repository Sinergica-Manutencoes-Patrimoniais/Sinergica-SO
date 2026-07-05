// pcm-auvo-users-sync — espelha técnicos/equipes do Auvo no cache local `pcm.tecnicos_cache`
// (Auvo → PCM, read-only do lado do PCM). AC-1 e AC-4 de
// specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md.
//
// Gatilho (AC-5): idêntico nos dois casos — a função não sabe quem a invocou, só que a chamada é
// autenticada como `service_role`. (a) `pg_cron` diário (migration 0013) via `net.http_post`; ou
// (b) invocação sob demanda `supabase functions invoke pcm-auvo-users-sync` / `curl` autenticado
// (ops/superadmin com a chave). Nenhuma tela de UI dedicada (fora de escopo).
//
// Guarda de soft-delete (AC-4/task 6): a reconciliação `ativo = false` dos técnicos que sumiram do
// Auvo SÓ roda se TODAS as páginas do sync foram buscadas com sucesso. `auvoPaginate` propaga
// qualquer erro de página; se propagar, o `catch` retorna erro ANTES de qualquer escrita no banco
// — nunca marcamos como inativo um técnico que só não foi alcançado por causa de um erro de rede
// parcial. Isso é intencional; não simplificar para "melhor esforço".
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem executado
// contra a API real do Auvo. Os nomes de campo da resposta do Auvo (`result`, `userID`/`id`,
// `userType`, `name`, `jobPosition`/`team`) e o formato de paginação (`paramFilter` com
// `page`/`pageSize`) seguem a descrição textual do mapeamento (mesma ressalva de `client.ts` desde
// E01-S09) — confirmar contra o mapeamento real / uma chamada de teste antes do primeiro deploy.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet, buildParamFilter } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";

const FN = "pcm-auvo-users-sync";

/** userType = 1 é o colaborador de campo no Auvo (AC-1: só técnico, não conta administrativa). */
const USER_TYPE_TECNICO = 1;

interface AuvoUser {
  userID?: number;
  id?: number;
  name?: string;
  userType?: number;
  jobPosition?: string;
  team?: string;
}

interface CacheRow {
  auvo_user_id: number;
  nome: string;
  equipe: string | null;
  ativo: true;
  updated_at: string;
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    // 1) Auth — chamada interna sistema→sistema (cron ou invocação manual autenticada), nunca frontend.
    requireServiceRole(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2) Pagina TODAS as páginas de `GET /users` (se qualquer página falhar, propaga → catch →
    //    nenhuma escrita no banco; guarda de soft-delete satisfeita por construção).
    const usuarios = await auvoPaginate<AuvoUser>(
      (pageNumber, pageSize) =>
        auvoGet<{ result?: AuvoUser[] }>(
          `/users?${buildParamFilter({ page: pageNumber, pageSize })}`,
        ).then((r) => r?.result ?? []),
      { pageSize: DEFAULT_PAGE_SIZE },
    );

    // 3) Filtra colaborador de campo (userType = 1). AC-1 é explícito: não cachear conta
    //    administrativa/escritório. Filtro client-side (após receber a página) — mais seguro que
    //    confiar num filtro server-side não verificado (mesmo raciocínio de pcm-auvo-customers-sync).
    const rows: CacheRow[] = [];
    const syncedIds = new Set<number>();
    for (const u of usuarios) {
      if (u.userType !== USER_TYPE_TECNICO) continue;
      const auvoUserId = u.userID ?? u.id;
      if (auvoUserId == null) {
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "usuário Auvo sem id — ignorado", user: u }));
        continue;
      }
      rows.push({
        auvo_user_id: auvoUserId,
        nome: u.name ?? `Técnico ${auvoUserId}`,
        equipe: u.team ?? u.jobPosition ?? null,
        ativo: true,
        updated_at: now,
      });
      syncedIds.add(auvoUserId);
    }

    // 4) Upsert por `auvo_user_id` (AC-1: um upsert por id, nunca duplica). Idempotente: rodar 2x
    //    seguidas produz o mesmo estado.
    if (rows.length > 0) {
      const { error: upsertError } = await db
        .schema("pcm")
        .from("tecnicos_cache")
        .upsert(rows, { onConflict: "auvo_user_id" });
      if (upsertError) throw upsertError;
    }

    // 5) Soft-delete (AC-4): técnicos que estavam no cache e sumiram do Auvo → `ativo = false`
    //    (nunca DELETE físico — OS históricas continuam exibindo o nome). Só chegamos aqui se a
    //    paginação inteira teve sucesso (guarda de task 6).
    //    [AUTO-DECISION] Se `syncedIds` vier vazio (Auvo respondeu com sucesso mas ZERO técnicos de
    //    campo), NÃO desativamos tudo em massa — logamos aviso e pulamos a reconciliação. Reason:
    //    AC-4 fala de técnico REMOVIDO individualmente; um resultado totalmente vazio de um endpoint
    //    externo é suspeito o suficiente (mudança de shape/filtro) para não valer uma desativação
    //    catastrófica do cache inteiro — mesma postura defensiva contra fallback perigoso que a
    //    guarda de task 6 adota. Registrado em tasks.md.
    let desativados = 0;
    if (syncedIds.size > 0) {
      const idList = `(${[...syncedIds].join(",")})`;
      const { data: deactivated, error: deactivateError } = await db
        .schema("pcm")
        .from("tecnicos_cache")
        .update({ ativo: false, updated_at: now })
        .eq("ativo", true)
        .not("auvo_user_id", "in", idList)
        .select("auvo_user_id");
      if (deactivateError) throw deactivateError;
      desativados = deactivated?.length ?? 0;
    } else {
      console.error(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "GET /users retornou 0 técnicos (userType=1) — reconciliação de soft-delete pulada para não desativar o cache em massa" }));
    }

    const resultado = { synced: rows.length, deactivated: desativados };
    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "sync concluído", ...resultado }));
    return json(200, resultado, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }));
      return problem(502, `Auvo indisponível ou erro: ${e.message}`, reqId, cors);
    }
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors); // nunca vaza stack
  }
});

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = {
    401: "Unauthorized",
    405: "Method Not Allowed",
    500: "Internal Server Error",
    502: "Bad Gateway",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
