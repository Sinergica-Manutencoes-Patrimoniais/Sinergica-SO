// pcm-auvo-equipment-sync — espelha equipamentos do Auvo em `pcm.equipamentos` (promovido em
// E01-S29 a partir do cache read-only `pcm.equipamentos_cache`). AC-2 e AC-4 de E01-S11 + E01-S29.
//
// Mesma estrutura de pcm-auvo-users-sync (paginação → upsert → soft-delete guardado), com um passo
// extra: resolver `auvo_customer_id`. O Auvo devolve `customerId` por equipamento; a FK do cache é
// `references pcm.clientes(auvo_id)` (migration 0012), então o `customerId` só pode ser gravado se
// existir um `pcm.clientes.auvo_id` correspondente. Se o cliente dono ainda não foi sincronizado
// por E01-S09 (syncs independentes), grava `auvo_customer_id = null` + log de aviso e NÃO falha o
// upsert do equipamento (FK nullable) — falhar aqui quebraria o sync inteiro por uma dependência
// cruzada que a spec não exige.
//
// Guarda de soft-delete (AC-4/task 6): idêntica a pcm-auvo-users-sync — reconciliação `ativo=false`
// só roda após TODAS as páginas terem sido buscadas com sucesso (auvoPaginate propaga erro → catch
// antes de qualquer escrita).
//
// Verificado contra a API real do Auvo em 2026-07-05: `/equipments` pagina com `page`/`pageSize`,
// devolve os registros em `result.entityList` e vincula cliente pelo campo `associatedCustomerId`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";

const FN = "pcm-auvo-equipment-sync";

interface AuvoEquipment {
  id?: number;
  equipmentId?: number;
  name?: string;
  description?: string;
  customerId?: number;
  associatedCustomerId?: number;
  active?: boolean;
}

interface AuvoEquipmentsResponse {
  result?: AuvoEquipment[] | {
    entityList?: AuvoEquipment[];
  };
}

interface CacheRow {
  auvo_equipment_id: number;
  auvo_id: number;
  nome: string;
  auvo_customer_id: number | null;
  client_id: string | null;
  auvo_sync_status: "synced";
  auvo_synced_at: string;
  ativo: boolean;
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

    // 1) Auth — chamada interna (cron ou invocação manual autenticada), nunca frontend.
    requireServiceRole(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2) Pagina TODAS as páginas de `GET /equipments` (erro em qualquer página propaga → catch →
    //    nenhuma escrita; guarda de soft-delete satisfeita por construção).
    const equipamentos = await auvoPaginate<AuvoEquipment>(
      (pageNumber, pageSize) =>
        auvoGet<AuvoEquipmentsResponse>(
          `/equipments?page=${pageNumber}&pageSize=${pageSize}&order=asc`,
        ).then((r) => {
          if (Array.isArray(r?.result)) return r.result;
          if (Array.isArray(r?.result?.entityList)) return r.result.entityList;
          return [];
        }),
      { pageSize: DEFAULT_PAGE_SIZE },
    );

    // 3) Resolve quais `customerId` do Auvo têm cliente correspondente já sincronizado no PCM
    //    (pcm.clientes.auvo_id). Consulta em lote (um SELECT) em vez de por-equipamento.
    const customerIds = [...new Set(equipamentos.map(auvoCustomerId).filter((c): c is number => c != null))];
    const clientesExistentes = new Map<number, string>();
    if (customerIds.length > 0) {
      const { data: clientes, error: clientesError } = await db
        .schema("pcm")
        .from("clientes")
        .select("id,auvo_id")
        .in("auvo_id", customerIds);
      if (clientesError) throw clientesError;
      for (const c of clientes ?? []) {
        if (c.auvo_id != null) clientesExistentes.set(c.auvo_id, c.id);
      }
    }

    // 4) Monta as linhas do cache. auvo_customer_id = customerId só se o cliente existir; senão null
    //    + aviso (não falha o equipamento).
    const rows: CacheRow[] = [];
    const syncedIds = new Set<number>();
    for (const e of equipamentos) {
      const auvoEquipmentId = e.id ?? e.equipmentId;
      if (auvoEquipmentId == null) {
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "equipamento Auvo sem id — ignorado", equip: e }));
        continue;
      }
      let resolvedAuvoCustomerId: number | null = null;
      let clientId: string | null = null;
      const customerId = auvoCustomerId(e);
      if (customerId != null) {
        if (clientesExistentes.has(customerId)) {
          resolvedAuvoCustomerId = customerId;
          clientId = clientesExistentes.get(customerId) ?? null;
        } else {
          console.error(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "cliente do equipamento ainda não sincronizado no PCM — auvo_customer_id gravado como null", auvo_equipment_id: auvoEquipmentId, customerId }));
        }
      }
      rows.push({
        auvo_equipment_id: auvoEquipmentId,
        auvo_id: auvoEquipmentId,
        nome: e.name ?? e.description ?? `Equipamento ${auvoEquipmentId}`,
        auvo_customer_id: resolvedAuvoCustomerId,
        client_id: clientId,
        auvo_sync_status: "synced",
        auvo_synced_at: now,
        ativo: e.active !== false,
        updated_at: now,
      });
      syncedIds.add(auvoEquipmentId);
    }

    // 5) Upsert por `auvo_equipment_id`, um RPC por linha via `fn_upsert_auvo_sync` — mesma RPC
    //    anti-loop do motor genérico (E01-S23), que seta `app.auvo_sync_write` ANTES de gravar.
    //    Sem isso, `trg_equipamentos_auvo_enqueue` (E01-S29) reenfileiraria esta escrita inbound de
    //    volta pro Auvo — inofensivo hoje só por `writeEnabled:false`, vira eco assim que for ligado
    //    (achado C2 da revisão adversarial de 2026-07-07). AC-2 preservado: upsert por id, idempotente.
    for (const row of rows) {
      const { error: upsertError } = await db.schema("pcm").rpc("fn_upsert_auvo_sync", {
        p_table: "equipamentos",
        p_auvo_id: String(row.auvo_equipment_id),
        p_patch: {
          auvo_equipment_id: row.auvo_equipment_id,
          nome: row.nome,
          auvo_customer_id: row.auvo_customer_id,
          client_id: row.client_id,
          auvo_sync_status: row.auvo_sync_status,
          auvo_synced_at: row.auvo_synced_at,
          ativo: row.ativo,
          updated_at: row.updated_at,
        },
      });
      if (upsertError) throw upsertError;
    }

    // 6) Soft-delete (AC-4) dos equipamentos que sumiram do Auvo. Mesma guarda/decisão de
    //    pcm-auvo-users-sync: só após paginação completa, pula se `syncedIds` vier vazio (evita
    //    desativação em massa por resposta suspeita — ver [AUTO-DECISION] em tasks.md), e usa o
    //    mesmo anti-loop do passo 5 (SELECT dos ids + `fn_apply_auvo_sync` por linha, em vez de um
    //    UPDATE em massa desprotegido).
    let desativados = 0;
    if (syncedIds.size > 0) {
      const idList = `(${[...syncedIds].join(",")})`;
      const { data: paraDesativar, error: selectError } = await db
        .schema("pcm")
        .from("equipamentos")
        .select("id")
        .eq("ativo", true)
        .not("auvo_equipment_id", "in", idList);
      if (selectError) throw selectError;
      for (const equipamento of paraDesativar ?? []) {
        const { error: deactivateError } = await db.schema("pcm").rpc("fn_apply_auvo_sync", {
          p_table: "equipamentos",
          p_row_id: equipamento.id,
          p_patch: { ativo: false, updated_at: now },
        });
        if (deactivateError) throw deactivateError;
      }
      desativados = paraDesativar?.length ?? 0;
    } else {
      console.error(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "GET /equipments retornou 0 equipamentos — reconciliação de soft-delete pulada para não desativar o cache em massa" }));
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

function auvoCustomerId(equipment: AuvoEquipment): number | null {
  return equipment.customerId ?? equipment.associatedCustomerId ?? null;
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
