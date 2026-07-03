// pcm-auvo-equipment-sync — espelha equipamentos do Auvo no cache local `pcm.equipamentos_cache`
// (Auvo → PCM, read-only do lado do PCM). AC-2 e AC-4 de
// specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md.
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
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI, não type-checado nem executado contra o Auvo real.
// Nomes de campo (`result`, `id`, `name`/`description`, `customerId`) e formato de paginação
// (`paramFilter` com `page`/`pageSize`) seguem a descrição textual do mapeamento (mesma ressalva de
// `client.ts` desde E01-S09) — confirmar antes do primeiro deploy.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet, buildParamFilter } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";

const FN = "pcm-auvo-equipment-sync";

interface AuvoEquipment {
  id?: number;
  equipmentId?: number;
  name?: string;
  description?: string;
  customerId?: number;
}

interface CacheRow {
  auvo_equipment_id: number;
  nome: string;
  auvo_customer_id: number | null;
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

    // 1) Auth — chamada interna (cron ou invocação manual autenticada), nunca frontend.
    requireServiceRole(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2) Pagina TODAS as páginas de `GET /equipments` (erro em qualquer página propaga → catch →
    //    nenhuma escrita; guarda de soft-delete satisfeita por construção).
    const equipamentos = await auvoPaginate<AuvoEquipment>(
      (pageNumber, pageSize) =>
        auvoGet<{ result?: AuvoEquipment[] }>(
          `/equipments?${buildParamFilter({ page: pageNumber, pageSize })}`,
        ).then((r) => r?.result ?? []),
      { pageSize: DEFAULT_PAGE_SIZE },
    );

    // 3) Resolve quais `customerId` do Auvo têm cliente correspondente já sincronizado no PCM
    //    (pcm.clientes.auvo_id). Consulta em lote (um SELECT) em vez de por-equipamento.
    const customerIds = [...new Set(equipamentos.map((e) => e.customerId).filter((c): c is number => c != null))];
    const clientesExistentes = new Set<number>();
    if (customerIds.length > 0) {
      const { data: clientes, error: clientesError } = await db
        .schema("pcm")
        .from("clientes")
        .select("auvo_id")
        .in("auvo_id", customerIds);
      if (clientesError) throw clientesError;
      for (const c of clientes ?? []) {
        if (c.auvo_id != null) clientesExistentes.add(c.auvo_id);
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
      let auvoCustomerId: number | null = null;
      if (e.customerId != null) {
        if (clientesExistentes.has(e.customerId)) {
          auvoCustomerId = e.customerId;
        } else {
          console.error(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "cliente do equipamento ainda não sincronizado no PCM — auvo_customer_id gravado como null", auvo_equipment_id: auvoEquipmentId, customerId: e.customerId }));
        }
      }
      rows.push({
        auvo_equipment_id: auvoEquipmentId,
        nome: e.name ?? e.description ?? `Equipamento ${auvoEquipmentId}`,
        auvo_customer_id: auvoCustomerId,
        ativo: true,
        updated_at: now,
      });
      syncedIds.add(auvoEquipmentId);
    }

    // 5) Upsert por `auvo_equipment_id` (AC-2: um upsert por id, nunca duplica; idempotente).
    if (rows.length > 0) {
      const { error: upsertError } = await db
        .schema("pcm")
        .from("equipamentos_cache")
        .upsert(rows, { onConflict: "auvo_equipment_id" });
      if (upsertError) throw upsertError;
    }

    // 6) Soft-delete (AC-4) dos equipamentos que sumiram do Auvo. Mesma guarda/decisão de
    //    pcm-auvo-users-sync: só após paginação completa, e pula se `syncedIds` vier vazio (evita
    //    desativação em massa por resposta suspeita). Ver [AUTO-DECISION] em tasks.md.
    let desativados = 0;
    if (syncedIds.size > 0) {
      const idList = `(${[...syncedIds].join(",")})`;
      const { data: deactivated, error: deactivateError } = await db
        .schema("pcm")
        .from("equipamentos_cache")
        .update({ ativo: false, updated_at: now })
        .eq("ativo", true)
        .not("auvo_equipment_id", "in", idList)
        .select("auvo_equipment_id");
      if (deactivateError) throw deactivateError;
      desativados = deactivated?.length ?? 0;
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
