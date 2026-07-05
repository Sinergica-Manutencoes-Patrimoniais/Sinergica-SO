// pcm-auvo-customers-import — importa clientes já cadastrados no Auvo para `pcm.clientes`
// (Auvo → PCM, bootstrap). Direção OPOSTA de `pcm-auvo-customers-sync` (E01-S09, PCM → Auvo) —
// as duas coexistem, cada uma resolve um problema diferente e nenhuma mexe na outra. AC-1, AC-2,
// AC-3, AC-4 de specs/E01-S13-import-inicial-clientes-auvo/spec.md.
//
// NOTA DE DEPLOY: `supabase functions deploy` não detecta mudanças em `_shared/*.ts` como diff
// desta function — precisa tocar o arquivo próprio da function para forçar redeploy (ver diag.
// de 2026-07-04, mismatch de SUPABASE_SERVICE_ROLE_KEY em requireServiceRole).
//
// Gatilho (AC-5): idêntico ao padrão de E01-S11 — a função não sabe quem a invocou, só que a
// chamada é autenticada como `service_role`. (a) `pg_cron` diário (migration 0015) via
// `net.http_post`; ou (b) invocação sob demanda `supabase functions invoke
// pcm-auvo-customers-import` / `curl` autenticado — é o caminho que resolve o bootstrap imediato
// (rodar uma vez manualmente logo após o deploy, sem esperar o cron).
//
// Guarda de soft-delete (AC-3): a reconciliação `ativo = false` dos clientes que sumiram do Auvo
// SÓ roda se TODAS as páginas do import foram buscadas com sucesso. `auvoPaginate` propaga
// qualquer erro de página; se propagar, o `catch` retorna erro ANTES de qualquer escrita no banco.
// Se a paginação tiver sucesso mas devolver ZERO clientes, a reconciliação também é pulada (mesma
// guarda defensiva que `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync` usam — um resultado vazio
// de endpoint externo é suspeito o bastante para não valer desativação em massa).
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem executado
// contra a API real do Auvo. Os nomes de campo da resposta de `GET /customers` (`result`,
// `id`/`customerId`, `description`/`name`) e o campo equivalente a CNPJ (se existir) seguem a
// descrição textual do mapeamento (mesma ressalva de `client.ts` desde E01-S09) — confirmar contra
// o mapeamento real / uma chamada de teste antes do primeiro deploy. Se não houver campo claro de
// CNPJ na resposta, `cnpj` é gravado `null` (coluna nullable, `0001_E00-S00`) — nunca inventado.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet } from "../_shared/auvo/client.ts";
import { auvoPaginate, DEFAULT_PAGE_SIZE } from "../_shared/auvo/paginate.ts";

const FN = "pcm-auvo-customers-import";

interface AuvoCustomer {
  id?: number;
  customerId?: number;
  code?: number;
  description?: string;
  name?: string;
  legalName?: string;
  cnpj?: string;
  cpfCnpj?: string;
  address?: string;
  adressComplement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  cep?: string;
  contactName?: string;
  phone?: string;
  phoneNumber?: string;
  mobilePhone?: string;
  email?: string;
  active?: boolean;
  notes?: string;
  note?: string;
}

interface AuvoCustomersResponse {
  result?: AuvoCustomer[] | {
    entityList?: AuvoCustomer[];
  };
}

interface CacheRow {
  auvo_id: number;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  status_comercial: "ativo" | "inativo";
  tipo: "cliente";
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  observacoes: string | null;
  updated_at: string;
  created_by: string;
  updated_by: string;
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
    const systemUserId = await obterUsuarioSistema(db);

    // 2) Pagina TODAS as páginas de `GET /customers` (se qualquer página falhar, propaga → catch →
    //    nenhuma escrita no banco; guarda de soft-delete satisfeita por construção).
    const clientes = await auvoPaginate<AuvoCustomer>(
      (pageNumber, pageSize) =>
        auvoGet<AuvoCustomersResponse>(
          `/customers?page=${pageNumber}&pageSize=${pageSize}&order=asc`,
        ).then((r) => {
          if (Array.isArray(r?.result)) return r.result;
          if (Array.isArray(r?.result?.entityList)) return r.result.entityList;
          return [];
        }),
      { pageSize: DEFAULT_PAGE_SIZE },
    );

    // 3) Mapeia Auvo → pcm.clientes. `cnpj` fica null se o payload não trouxer campo equivalente —
    //    nunca inventado (AC-4).
    const rows: CacheRow[] = [];
    const syncedIds = new Set<number>();
    for (const c of clientes) {
      const auvoId = c.id ?? c.customerId ?? c.code;
      if (auvoId == null) {
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "cliente Auvo sem id — ignorado", cliente: c }));
        continue;
      }
      const endereco = textoOuNull(c.address);
      const enderecoDerivado = extrairPartesEndereco(endereco);
      const observacoes = [c.note, c.notes, c.adressComplement].map(textoOuNull).filter(Boolean).join(" · ");
      rows.push({
        auvo_id: auvoId,
        nome: c.description ?? c.name ?? `Cliente ${auvoId}`,
        cnpj: normalizarCnpj(c.cnpj ?? c.cpfCnpj),
        ativo: c.active !== false,
        status_comercial: c.active === false ? "inativo" : "ativo",
        tipo: "cliente",
        endereco,
        cidade: textoOuNull(c.city) ?? enderecoDerivado.cidade,
        estado: textoOuNull(c.state) ?? enderecoDerivado.estado,
        cep: textoOuNull(c.zipCode ?? c.cep) ?? enderecoDerivado.cep,
        contato_nome: textoOuNull(c.contactName ?? c.legalName),
        contato_telefone: textoOuNull(c.phone ?? c.phoneNumber ?? c.mobilePhone),
        contato_email: textoOuNull(c.email),
        observacoes: textoOuNull(observacoes),
        updated_at: now,
        created_by: systemUserId,
        updated_by: systemUserId,
      });
      syncedIds.add(auvoId);
    }

    // 4) Upsert por `auvo_id` (AC-1/AC-2: um upsert por id, nunca duplica — coluna já `unique`
    //    desde 0001_E00-S00). Idempotente: rodar 2x seguidas produz o mesmo estado.
    if (rows.length > 0) {
      const { error: upsertError } = await db
        .schema("pcm")
        .from("clientes")
        .upsert(rows, { onConflict: "auvo_id" });
      if (upsertError) throw upsertError;
    }

    // 5) Soft-delete (AC-3): clientes que estavam no PCM (importados) e sumiram do Auvo →
    //    `ativo = false` (nunca DELETE físico — `pcm.ordens_servico.client_id` é FK não anulável,
    //    OS históricas quebrariam). Só chegamos aqui se a paginação inteira teve sucesso.
    //    [AUTO-DECISION] Se `syncedIds` vier vazio (Auvo respondeu com sucesso mas ZERO clientes),
    //    NÃO desativamos tudo em massa — logamos aviso e pulamos a reconciliação. Mesmo raciocínio
    //    defensivo de `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync` (E01-S11): um resultado
    //    totalmente vazio de um endpoint externo é suspeito o bastante (mudança de shape/filtro)
    //    para não valer uma desativação catastrófica de todo o cadastro de clientes.
    let desativados = 0;
    if (syncedIds.size > 0) {
      const idList = `(${[...syncedIds].join(",")})`;
      const { data: deactivated, error: deactivateError } = await db
        .schema("pcm")
        .from("clientes")
        .update({ ativo: false, updated_at: now })
        .eq("ativo", true)
        .not("auvo_id", "is", null)
        .not("auvo_id", "in", idList)
        .select("auvo_id");
      if (deactivateError) throw deactivateError;
      desativados = deactivated?.length ?? 0;
    } else {
      console.error(JSON.stringify({ ts: now, nivel: "warn", fn: FN, reqId, msg: "GET /customers retornou 0 clientes — reconciliação de soft-delete pulada para não desativar o cadastro em massa" }));
    }

    const resultado = { imported: rows.length, deactivated: desativados };
    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "import concluído", ...resultado }));
    return json(200, resultado, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }));
      return problem(502, `Auvo indisponível ou erro: ${e.message}`, reqId, cors);
    }
    const detail = safeErrorDetail(e);
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail }));
    return problem(500, `Erro interno: ${detail}`, reqId, cors);
  }
});

function safeErrorDetail(e: unknown): string {
  const raw = e instanceof Error ? e.message : JSON.stringify(e);
  return (raw || String(e))
    .replace(/apiKey=[^&\s"]+/gi, "apiKey=[redacted]")
    .replace(/apiToken=[^&\s"]+/gi, "apiToken=[redacted]")
    .replace(/Bearer\s+[^,\s"]+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

async function obterUsuarioSistema(db: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await db
    .schema("config")
    .from("usuarios")
    .select("user_id,papel,created_at")
    .eq("ativo", true)
    .in("papel", ["superadmin", "supervisor"])
    .order("papel", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.user_id) {
    throw new HttpError(500, "Nenhum usuário ativo superadmin/supervisor encontrado para autoria do import");
  }

  return data.user_id as string;
}

function normalizarCnpj(valor: unknown): string | null {
  const cnpj = textoOuNull(valor);
  return cnpj ? cnpj : null;
}

function textoOuNull(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto ? texto : null;
}

function extrairPartesEndereco(endereco: string | null): {
  cidade: string | null;
  estado: string | null;
  cep: string | null;
} {
  if (!endereco) return { cidade: null, estado: null, cep: null };

  const cep = endereco.match(/\b\d{5}-?\d{3}\b/)?.[0] ?? null;
  const cidadeEstado = endereco.match(/,\s*([^,]+?)\s*-\s*([A-Z]{2})(?:,|\s*$)/);
  if (!cidadeEstado) return { cidade: null, estado: null, cep };

  return {
    cidade: textoOuNull(cidadeEstado[1]),
    estado: textoOuNull(cidadeEstado[2]),
    cep,
  };
}

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
