// pcm-auvo-users-sync — espelha técnicos/equipes do Auvo em `pcm.funcionarios` (promovido em
// E01-S28 a partir do cache read-only `pcm.tecnicos_cache`). AC-1 e AC-4 de
// specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md + E01-S28 AC-4.
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
// Verificado contra a API real do Auvo em 2026-07-05: `/users` pagina com `page`/`pageSize` e
// devolve os registros em `result.entityList`; `userType` pode vir como objeto com `userTypeId`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";

const FN = "pcm-auvo-users-sync";

/** userType = 1 é o colaborador de campo no Auvo (AC-1: só técnico, não conta administrativa). */
const USER_TYPE_TECNICO = 1;

interface AuvoUser {
  userID?: number;
  id?: number;
  name?: string;
  userType?: number | {
    userTypeId?: number;
    description?: string;
  };
  jobPosition?: string;
  team?: string;
}

interface AuvoUsersResponse {
  result?: AuvoUser[] | {
    entityList?: AuvoUser[];
  };
}

interface CacheRow {
  auvo_user_id: number;
  auvo_id: number;
  nome: string;
  equipe: string | null;
  cargo: string | null;
  culture: string;
  user_type: number;
  auvo_sync_status: "synced";
  auvo_synced_at: string;
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
        auvoGet<AuvoUsersResponse>(
          `/users?page=${pageNumber}&pageSize=${pageSize}&order=asc`,
        ).then((r) => {
          if (Array.isArray(r?.result)) return r.result;
          if (Array.isArray(r?.result?.entityList)) return r.result.entityList;
          return [];
        }),
      { pageSize: DEFAULT_PAGE_SIZE },
    );

    // 3) Filtra colaborador de campo (userType = 1). AC-1 é explícito: não cachear conta
    //    administrativa/escritório. Filtro client-side (após receber a página) — mais seguro que
    //    confiar num filtro server-side não verificado (mesmo raciocínio de pcm-auvo-customers-sync).
    const rows: CacheRow[] = [];
    const syncedIds = new Set<number>();
    for (const u of usuarios) {
      if (auvoUserTypeId(u.userType) !== USER_TYPE_TECNICO) continue;
      const auvoUserId = u.userID ?? u.id;
      if (auvoUserId == null) {
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "usuário Auvo sem id — ignorado", user: u }));
        continue;
      }
      rows.push({
        auvo_user_id: auvoUserId,
        auvo_id: auvoUserId,
        nome: u.name ?? `Técnico ${auvoUserId}`,
        equipe: u.team ?? u.jobPosition ?? null,
        cargo: u.jobPosition ?? null,
        culture: "pt-BR",
        user_type: USER_TYPE_TECNICO,
        auvo_sync_status: "synced",
        auvo_synced_at: now,
        ativo: true,
        updated_at: now,
      });
      syncedIds.add(auvoUserId);
    }

    // 4) Upsert por `auvo_user_id`, um RPC por linha via `fn_upsert_auvo_sync` — a mesma RPC
    //    anti-loop do motor genérico (E01-S23), que seta `app.auvo_sync_write` ANTES de gravar.
    //    Sem isso, o trigger `trg_funcionarios_auvo_enqueue` (E01-S28) reenfileiraria esta escrita
    //    inbound como se fosse uma mudança local a empurrar de volta pro Auvo — inofensivo hoje só
    //    porque `writeEnabled:false` barra o PATCH, mas vira eco de escrita assim que for ligado
    //    (achado C2 da revisão adversarial de 2026-07-07). AC-1 preservado: upsert por id, idempotente.
    for (const row of rows) {
      const { error: upsertError } = await db.schema("pcm").rpc("fn_upsert_auvo_sync", {
        p_table: "funcionarios",
        p_auvo_id: String(row.auvo_user_id),
        p_patch: {
          auvo_user_id: row.auvo_user_id,
          nome: row.nome,
          equipe: row.equipe,
          cargo: row.cargo,
          culture: row.culture,
          user_type: row.user_type,
          auvo_sync_status: row.auvo_sync_status,
          auvo_synced_at: row.auvo_synced_at,
          ativo: row.ativo,
          updated_at: row.updated_at,
        },
      });
      if (upsertError) throw upsertError;
    }

    // 5) Soft-delete (AC-4): técnicos que estavam no cache e sumiram do Auvo → `ativo = false`
    //    (nunca DELETE físico — OS históricas continuam exibindo o nome). Só chegamos aqui se a
    //    paginação inteira teve sucesso (guarda de task 6). Mesmo anti-loop do passo 4: identifica
    //    os ids primeiro (SELECT simples, sem gravar) e aplica cada patch via `fn_apply_auvo_sync`
    //    (GUC anti-loop), em vez de um UPDATE em massa desprotegido.
    //    [AUTO-DECISION] Se `syncedIds` vier vazio (Auvo respondeu com sucesso mas ZERO técnicos de
    //    campo), NÃO desativamos tudo em massa — logamos aviso e pulamos a reconciliação. Reason:
    //    AC-4 fala de técnico REMOVIDO individualmente; um resultado totalmente vazio de um endpoint
    //    externo é suspeito o suficiente (mudança de shape/filtro) para não valer uma desativação
    //    catastrófica do cache inteiro — mesma postura defensiva contra fallback perigoso que a
    //    guarda de task 6 adota. Registrado em tasks.md.
    let desativados = 0;
    if (syncedIds.size > 0) {
      const idList = `(${[...syncedIds].join(",")})`;
      const { data: paraDesativar, error: selectError } = await db
        .schema("pcm")
        .from("funcionarios")
        .select("id")
        .eq("ativo", true)
        .not("auvo_user_id", "in", idList);
      if (selectError) throw selectError;
      for (const funcionario of paraDesativar ?? []) {
        const { error: deactivateError } = await db.schema("pcm").rpc("fn_apply_auvo_sync", {
          p_table: "funcionarios",
          p_row_id: funcionario.id,
          p_patch: { ativo: false, updated_at: now },
        });
        if (deactivateError) throw deactivateError;
      }
      desativados = paraDesativar?.length ?? 0;
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

function auvoUserTypeId(userType: AuvoUser["userType"]): number | null {
  if (typeof userType === "number") return userType;
  if (typeof userType?.userTypeId === "number") return userType.userTypeId;
  return null;
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
