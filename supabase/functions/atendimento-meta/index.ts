// atendimento-meta — E02-S16 (ADR-1700). Conexão de canal Meta (Instagram Direct, Messenger e
// WhatsApp Cloud) feita PELA TELA, com as credenciais indo direto para o Vault.
//
// Nenhum segredo volta para o browser, nem fica em `atendimento.canais_externos` (cuja policy de
// SELECT libera qualquer usuário com `atendimento` em leitura). O que a tela recebe de volta é o
// estado e a URL de callback para colar na Meta.
//
// Autorização: o canal é lido e ATUALIZADO pelo client do próprio chamador (anon key + JWT), antes
// de qualquer escrita de segredo — quem a RLS barra não chega no Vault.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { metaRequest, metaRequestComToken } from "../_shared/meta.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";

const FN = "atendimento-meta";

const InputSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("verificar"), canalId: z.string().uuid() }),
  z.object({ acao: z.literal("obter"), canalId: z.string().uuid() }),
  z.object({ acao: z.literal("criar_template"), templateId: z.string().uuid() }),
  z.object({
    acao: z.literal("conectar"),
    canalId: z.string().uuid(),
    contaExternaId: z.string().regex(/^[0-9]{1,64}$/, "Identificador da conta deve ser numérico"),
    accessToken: z.string().min(20).max(500),
    appSecret: z.string().min(10).max(200),
    verifyToken: z.string().min(10).max(200),
    graphVersion: z.string().regex(/^v[0-9]+\.[0-9]+$/).optional(),
  }),
]);

/** `SINERGICA_<RECURSO>_<GERACAO>_<32HEX>` — único formato que o cofre de 1847 aceita. */
function referencia(recurso: string, geracao: number, canalId: string): string {
  return `SINERGICA_${recurso}_${geracao}_${canalId.replace(/-/g, "").toLowerCase()}`;
}

function geracaoDaReferencia(ref: string | null | undefined): number {
  const casado = typeof ref === "string" ? /_([0-9]+)_[0-9a-f]{32}$/.exec(ref) : null;
  return casado === null ? 0 : Number(casado[1]);
}

function callbackDoCanal(canalId: string): string {
  return `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/atendimento-meta-webhook/${canalId}`;
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    const { userId } = await requireAuth(req);
    const input = InputSchema.parse(await req.json());
    const token = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: token } },
    });

    if (input.acao === "criar_template") {
      return json(200, await criarTemplate(db, input.templateId), cors);
    }

    if (input.acao === "conectar") {
      return json(200, await conectar(db, userId, input), cors);
    }

    if (input.acao === "obter") {
      return json(200, await obter(db, input.canalId), cors);
    }

    return json(200, await verificar(db, input.canalId), cors);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 422 : 502;
    console.error(
      JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, status }),
    );
    return json(
      status,
      { ok: false, detail: error instanceof Error ? error.message : "Erro Meta" },
      cors,
    );
  }
});

function servico(): UntypedSupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", getSupabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Conecta o canal: confere a credencial contra o Graph ANTES de guardar, grava os três segredos
 * no Vault por referência opaca e deixa só as referências no banco. */
async function conectar(
  db: UntypedSupabaseClient,
  userId: string,
  input: Extract<z.infer<typeof InputSchema>, { acao: "conectar" }>,
) {
  const { data: canal, error } = await db
    .schema("atendimento")
    .from("canais_externos")
    .select("id, tipo")
    .eq("id", input.canalId)
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw error;
  if (!canal) throw new HttpError(404, "Canal não encontrado");
  if (!["instagram", "messenger", "meta_wa"].includes(String(canal.tipo))) {
    throw new HttpError(409, "Este canal não é um canal Meta");
  }

  // A identidade tem que BATER: token que responde por outra conta é recusado, não aceito "porque
  // o Graph respondeu 200".
  const perfil = await metaRequestComToken(
    input.accessToken,
    `${encodeURIComponent(input.contaExternaId)}?fields=id`,
    {},
    input.graphVersion,
  ).catch(() => {
    throw new HttpError(422, "A Meta recusou o token para esta conta. Confira token e ID da conta.");
  });
  if (String(perfil.id ?? "") !== input.contaExternaId) {
    throw new HttpError(422, "O token pertence a outra conta da Meta.");
  }

  // A escrita abaixo passa pela RLS do chamador: quem não tem `atendimento` em escrita para aqui,
  // antes de qualquer segredo encostar no Vault.
  const { error: erroCanal } = await db
    .schema("atendimento")
    .from("canais_externos")
    .update({
      identificador_externo: input.contaExternaId,
      webhook_registrado: true,
      estado_conexao: "conectado_verificado",
      saude: "saudavel",
      ultimo_sucesso_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", input.canalId);
  if (erroCanal) throw new HttpError(403, "Sem permissão para configurar este canal");

  const service = servico();
  const { data: existente } = await service
    .schema("atendimento")
    .from("meta_canal")
    .select("token_ref")
    .eq("canal_id", input.canalId)
    .maybeSingle();
  const geracao = geracaoDaReferencia(existente?.token_ref as string | undefined) + 1;

  const refs = {
    token_ref: referencia("METATOKEN", geracao, input.canalId),
    app_secret_ref: referencia("METASECRET", geracao, input.canalId),
    verify_token_ref: referencia("METAVERIFY", geracao, input.canalId),
  };
  await gravarSegredo(service, refs.token_ref, input.accessToken);
  await gravarSegredo(service, refs.app_secret_ref, input.appSecret);
  await gravarSegredo(service, refs.verify_token_ref, input.verifyToken);

  const { error: erroMeta } = await service
    .schema("atendimento")
    .from("meta_canal")
    .upsert(
      {
        canal_id: input.canalId,
        conta_externa_id: input.contaExternaId,
        ...refs,
        graph_version: input.graphVersion ?? "v22.0",
        estado: "conectado",
        indicio_token: input.accessToken.slice(-4),
        atualizado_por: userId,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "canal_id" },
    );
  if (erroMeta) throw erroMeta;

  return { ok: true, estado: "conectado", callbackUrl: callbackDoCanal(input.canalId) };
}

async function gravarSegredo(service: UntypedSupabaseClient, ref: string, valor: string) {
  const { error } = await service
    .schema("config")
    .rpc("fn_gravar_segredo_referenciado", { p_ref: ref, p_valor: valor });
  if (error) throw error;
}

/** Estado sanitizado para a tela: nunca referência, nunca token. */
async function obter(db: UntypedSupabaseClient, canalId: string) {
  const { data: canal, error } = await db
    .schema("atendimento")
    .from("canais_externos")
    .select("id, estado_conexao, saude, identificador_externo")
    .eq("id", canalId)
    .maybeSingle();
  if (error) throw error;
  if (!canal) throw new HttpError(404, "Canal não encontrado");

  const { data: meta } = await servico()
    .schema("atendimento")
    .from("meta_canal")
    .select("estado, graph_version, indicio_token, atualizado_em")
    .eq("canal_id", canalId)
    .maybeSingle();

  return {
    ok: true,
    estadoConexao: canal.estado_conexao,
    saude: canal.saude,
    contaExternaId: canal.identificador_externo,
    estadoCredencial: meta?.estado ?? "sem_credencial",
    graphVersion: meta?.graph_version ?? "v22.0",
    indicioToken: meta?.indicio_token ?? null,
    atualizadoEm: meta?.atualizado_em ?? null,
    callbackUrl: callbackDoCanal(canalId),
  };
}

/** Confere que a credencial guardada ainda responde. Falha marca o canal como degradado, nunca
 * apaga a credencial — "desconectado com credencial anterior" é um estado próprio (ADR-1686). */
async function verificar(db: UntypedSupabaseClient, canalId: string) {
  const { data: canal, error } = await db
    .schema("atendimento")
    .from("canais_externos")
    .select("id, identificador_externo")
    .eq("id", canalId)
    .maybeSingle();
  if (error) throw error;
  if (!canal?.identificador_externo) throw new HttpError(404, "Canal sem identificador");

  const service = servico();
  const { data: meta } = await service
    .schema("atendimento")
    .from("meta_canal")
    .select("token_ref, graph_version, conta_externa_id")
    .eq("canal_id", canalId)
    .maybeSingle();
  if (!meta?.token_ref) throw new HttpError(409, "Canal ainda não conectado");

  const { data: token } = await service
    .schema("config")
    .rpc("fn_ler_segredo_referenciado", { p_ref: meta.token_ref });
  if (typeof token !== "string" || token.trim() === "") {
    throw new HttpError(409, "Credencial do canal não está no cofre");
  }

  const agora = new Date().toISOString();
  try {
    await metaRequestComToken(
      token,
      `${encodeURIComponent(String(meta.conta_externa_id))}?fields=id`,
      {},
      String(meta.graph_version),
    );
  } catch (erro) {
    await db
      .schema("atendimento")
      .from("canais_externos")
      .update({ saude: "degradada", ultimo_erro_em: agora, updated_at: agora })
      .eq("id", canalId);
    await service
      .schema("atendimento")
      .from("meta_canal")
      .update({ estado: "erro", atualizado_em: agora })
      .eq("canal_id", canalId);
    throw new HttpError(502, erro instanceof Error ? erro.message : "A Meta recusou a credencial");
  }

  await db
    .schema("atendimento")
    .from("canais_externos")
    .update({
      estado_conexao: "conectado_verificado",
      saude: "saudavel",
      ultimo_sucesso_em: agora,
      updated_at: agora,
    })
    .eq("id", canalId);
  await service
    .schema("atendimento")
    .from("meta_canal")
    .update({ estado: "conectado", atualizado_em: agora })
    .eq("canal_id", canalId);

  return { ok: true, status: "conectado" };
}

/** WhatsApp Cloud: criação de template continua no token global `META_ACCESS_TOKEN` enquanto
 * aquele caminho não migra para credencial por canal (débito em docs/SECURITY_DEBT.md). */
async function criarTemplate(db: UntypedSupabaseClient, templateId: string) {
  const { data: template, error } = await db
    .schema("atendimento")
    .from("wa_templates")
    .select("id,nome,idioma,categoria,corpo,canal_id")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw error;
  if (!template) throw new HttpError(404, "Template não encontrado");

  const { data: canal, error: canalError } = await db
    .schema("atendimento")
    .from("canais_externos")
    .select("waba_id")
    .eq("id", template.canal_id)
    .maybeSingle();
  if (canalError) throw canalError;
  if (!canal?.waba_id) throw new HttpError(400, "WABA ID não configurado");

  await metaRequest(`${encodeURIComponent(String(canal.waba_id))}/message_templates`, {
    method: "POST",
    body: JSON.stringify({
      name: template.nome,
      language: template.idioma,
      category: String(template.categoria).toUpperCase(),
      components: [{ type: "BODY", text: template.corpo }],
    }),
  });
  return { ok: true, status: "pending" };
}

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
