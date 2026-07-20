// pmoc-generate-pdf — E01-S05 AC-3/AC-4. Gera o laudo PDF de uma visita PMOC (pcm.pmoc_records),
// sobe pro bucket privado `pmoc-laudos`, grava o caminho em pdf_url. Se a integração de e-mail
// (E00-S12) estiver ativa e configurada, envia ao contato do imóvel — sem integração, gera e salva
// normalmente e só pula o envio (nunca falha silencioso, nunca finge que enviou).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";

const InputSchema = z.object({ recordId: z.string().uuid() });

const BUCKET = "pmoc-laudos";

function claimsFrom(req: Request): { user_role?: string; user_modulos?: Record<string, string> } {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    await requireAuth(req);
    const claims = claimsFrom(req);
    if (claims.user_role !== "superadmin" && claims.user_modulos?.pcm !== "escrita") {
      throw new HttpError(403, "Sem permissão de escrita no PCM");
    }
    const { recordId } = InputSchema.parse(await req.json());

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: record, error: recordError } = await db
      .schema("pcm")
      .from("pmoc_records")
      .select(
        "id,contract_id,property_id,executed_date,maintenance_type,technician_name,auvo_os_number,checklist",
      )
      .eq("id", recordId)
      .maybeSingle();
    if (recordError) throw recordError;
    if (!record) throw new HttpError(404, "Registro de visita não encontrado");

    const { data: property, error: propertyError } = await db
      .schema("pcm")
      .from("pmoc_properties")
      .select("name, address, city, state, contact_email, contact_name")
      .eq("id", record.property_id)
      .maybeSingle();
    if (propertyError) throw propertyError;

    const { data: contract, error: contractError } = await db
      .schema("pcm")
      .from("pmoc_contracts")
      .select("technician_name, crea, art_number")
      .eq("id", record.contract_id)
      .maybeSingle();
    if (contractError) throw contractError;

    const { data: ncs } = await db
      .schema("pcm")
      .from("pmoc_nonconformity_log")
      .select("description, severity")
      .eq("record_id", recordId);

    const pdfBytes = await gerarPdf({ record, property, contract, ncs: ncs ?? [] });

    const path = `${record.property_id}/${recordId}.pdf`;
    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const { error: updateError } = await db
      .schema("pcm")
      .from("pmoc_records")
      .update({ pdf_url: path })
      .eq("id", recordId);
    if (updateError) throw updateError;

    const emailResult = await tentarEnviarEmail(db, {
      to: property?.contact_email ?? null,
      propertyName: property?.name ?? "Imóvel PMOC",
      pdfBytes,
    });

    return new Response(
      JSON.stringify({ ok: true, recordId, path, emailSent: emailResult.sent, emailSkippedReason: emailResult.skippedReason }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } },
    );
  } catch (e) {
    if (e instanceof HttpError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    console.error(JSON.stringify({ nivel: "error", msg: "erro inesperado", detail: String(e) }));
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
});

interface ChecklistItem {
  id?: string;
  checked?: boolean;
}

async function gerarPdf(params: {
  // biome-ignore lint/suspicious/noExplicitAny: linhas do Postgres, sem tipo gerado no repo
  record: any;
  // biome-ignore lint/suspicious/noExplicitAny: idem
  property: any;
  // biome-ignore lint/suspicious/noExplicitAny: idem
  contract: any;
  ncs: Array<{ description: string; severity: string }>;
}): Promise<Uint8Array> {
  const { record, property, contract, ncs } = params;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;

  function linha(texto: string, opts: { negrito?: boolean; tamanho?: number; espaco?: number } = {}) {
    const { negrito = false, tamanho = 11, espaco = 18 } = opts;
    page.drawText(texto, { x: 40, y, size: tamanho, font: negrito ? bold : font, color: rgb(0.1, 0.1, 0.1) });
    y -= espaco;
  }

  linha("Laudo de Visita — PMOC", { negrito: true, tamanho: 18, espaco: 28 });
  linha(`Imóvel: ${property?.name ?? "—"}`, { negrito: true });
  linha(`Endereço: ${[property?.address, property?.city, property?.state].filter(Boolean).join(", ") || "—"}`);
  linha(`Responsável técnico: ${contract?.technician_name ?? "—"} (CREA ${contract?.crea ?? "—"})`);
  linha(`ART: ${contract?.art_number ?? "—"}`);
  y -= 8;
  linha(`Data da visita: ${record.executed_date ?? "—"}`, { negrito: true });
  linha(`Tipo de manutenção: ${record.maintenance_type ?? "—"}`);
  linha(`Técnico executante: ${record.technician_name ?? "—"}`);
  linha(`OS de referência: ${record.auvo_os_number ?? "—"}`);
  y -= 8;

  linha("Checklist", { negrito: true, tamanho: 13, espaco: 20 });
  const checklist = (record.checklist as ChecklistItem[] | null) ?? [];
  if (checklist.length === 0) {
    linha("Sem checklist registrado nesta visita.", { tamanho: 10 });
  } else {
    for (const item of checklist.slice(0, 30)) {
      linha(`${item.checked ? "[x]" : "[ ]"} ${item.id ?? ""}`, { tamanho: 10, espaco: 14 });
    }
  }
  y -= 8;

  linha("Não-conformidades", { negrito: true, tamanho: 13, espaco: 20 });
  if (ncs.length === 0) {
    linha("Nenhuma não-conformidade registrada.", { tamanho: 10 });
  } else {
    for (const nc of ncs) {
      linha(`[${nc.severity}] ${nc.description}`, { tamanho: 10, espaco: 14 });
    }
  }

  return doc.save();
}

async function tentarEnviarEmail(
  // biome-ignore lint/suspicious/noExplicitAny: cliente supabase-js sem tipos gerados no repo
  db: any,
  params: { to: string | null; propertyName: string; pdfBytes: Uint8Array },
): Promise<{ sent: boolean; skippedReason?: string }> {
  if (!params.to) return { sent: false, skippedReason: "imóvel sem e-mail de contato" };

  const { data: integracao } = await db
    .schema("config")
    .from("integracoes")
    .select("ativo, provedor, config_publico")
    .eq("chave", "email")
    .maybeSingle();
  if (!integracao?.ativo) {
    return { sent: false, skippedReason: "integração de e-mail não está ativa (Config > Integrações)" };
  }

  const { data: apiKey } = await db
    .schema("config")
    .rpc("fn_obter_segredo_integracao_interno", { p_chave: "email" });
  if (!apiKey) {
    return { sent: false, skippedReason: "chave da integração de e-mail não configurada" };
  }

  const fromEmail = integracao.config_publico?.fromEmail ?? "pmoc@sinergica.com.br";
  const fromName = integracao.config_publico?.fromName ?? "Sinérgica Manutenções";

  // Resend REST API — único provedor suportado por ora (E00-S12).
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [params.to],
      subject: `Laudo de visita PMOC — ${params.propertyName}`,
      html: `<p>Segue em anexo o laudo da visita de manutenção PMOC do imóvel <strong>${params.propertyName}</strong>.</p>`,
      attachments: [
        {
          filename: "laudo-pmoc.pdf",
          content: btoa(String.fromCharCode(...params.pdfBytes)),
        },
      ],
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.error(JSON.stringify({ nivel: "error", msg: "falha ao enviar e-mail via Resend", status: resp.status, detail }));
    return { sent: false, skippedReason: `falha no envio (HTTP ${resp.status})` };
  }
  return { sent: true };
}
