// atendimento-evolution — E02-S19. Administração autenticada de instâncias da Evolution API.
// A API key permanece exclusivamente no ambiente da Edge Function; o browser recebe somente
// estado, número vinculado e QR transitório.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import {
  criarConfiguracaoWebhook,
  criarPayloadInstancia,
} from "../_shared/evolution-admin.ts";

const FN = "atendimento-evolution";
const InputSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("listar") }),
  z.object({
    acao: z.literal("criar"),
    label: z.string().trim().min(1).max(120),
    instanceName: z.string().regex(/^[A-Za-z0-9_-]+$/).max(120),
    userId: z.string().uuid(),
  }),
  z.object({ acao: z.literal("conectar"), id: z.string().uuid() }),
  z.object({ acao: z.literal("desconectar"), id: z.string().uuid() }),
  z.object({ acao: z.literal("sincronizar_webhook"), id: z.string().uuid() }),
]);

type StatusConexao = "conectado" | "desconectado" | "erro";

interface CanalRow {
  id: string;
  label: string;
  identificador_externo: string | null;
  numero_vinculado: string | null;
  status_conexao: StatusConexao;
  webhook_registrado: boolean;
  ativo: boolean;
}

interface EstadoRemoto {
  status: StatusConexao;
  numeroVinculado: string | null;
  qrCode: string | null;
}

class EvolutionApiError extends Error {
  constructor(public status: number) {
    super(`Evolution API respondeu ${status}`);
  }
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    const { userId } = await requireAuth(req);
    const input = InputSchema.parse(await req.json());
    if ("userId" in input && input.userId !== userId) {
      throw new HttpError(403, "Usuário do payload não corresponde à sessão");
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!url || !anonKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    if (input.acao === "listar") {
      const { data, error } = await userClient
        .schema("atendimento")
        .from("canais_externos")
        .select("id,label,identificador_externo,numero_vinculado,status_conexao,webhook_registrado,ativo")
        .eq("tipo", "evolution")
        .eq("ativo", true)
        .order("label");
      if (error) throw error;

      const instancias = await Promise.all(
        ((data ?? []) as CanalRow[]).map(async (row) => {
          try {
            const estado = await consultarEstado(row.identificador_externo ?? "");
            // Leitor sem permissão de escrita continua podendo consultar: persistir o snapshot é
            // best-effort e a resposta usa o estado remoto mesmo se a policy negar o UPDATE.
            await userClient
              .schema("atendimento")
              .from("canais_externos")
              .update({
                status_conexao: estado.status,
                numero_vinculado: estado.numeroVinculado,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            return mapInstancia(row, estado, null);
          } catch (error) {
            return mapInstancia(
              row,
              { status: "erro", numeroVinculado: row.numero_vinculado, qrCode: null },
              mensagemSegura(error),
            );
          }
        }),
      );
      return json(200, { instancias }, cors);
    }

    if (input.acao === "criar") {
      const { data, error } = await userClient
        .schema("atendimento")
        .from("canais_externos")
        .insert({
          tipo: "evolution",
          label: input.label,
          identificador_externo: input.instanceName,
          status_conexao: "desconectado",
          created_by: userId,
        })
        .select("id,label,identificador_externo,numero_vinculado,status_conexao,webhook_registrado,ativo")
        .single();
      if (error) {
        if (error.code === "23505") throw new HttpError(409, "Instance ID já cadastrado");
        throw error;
      }
      const row = data as CanalRow;

      try {
        const payload = await evolutionRequest("/instance/create", {
          method: "POST",
          body: JSON.stringify(payloadCriacao(input.instanceName)),
        });
        await configurarWebhook(input.instanceName);
        const estado = estadoDoPayload(payload);
        await atualizarSnapshot(userClient, row.id, estado, true);
        return json(200, {
          instancia: mapInstancia({ ...row, webhook_registrado: true }, estado, null),
          qrCode: estado.qrCode,
        }, cors);
      } catch (error) {
        await marcarErro(userClient, row.id);
        throw error;
      }
    }

    const row = await buscarInstancia(userClient, input.id);
    const instanceName = row.identificador_externo ?? "";
    await exigirEscritaInstancia(userClient, row, userId);

    if (input.acao === "sincronizar_webhook") {
      await configurarWebhook(instanceName);
      await atualizarSnapshot(
        userClient,
        row.id,
        { status: row.status_conexao, numeroVinculado: row.numero_vinculado, qrCode: null },
        true,
      );
      return json(200, {
        instancia: mapInstancia({ ...row, webhook_registrado: true }, {
          status: row.status_conexao,
          numeroVinculado: row.numero_vinculado,
          qrCode: null,
        }, null),
      }, cors);
    }

    if (input.acao === "conectar") {
      try {
        let payload: unknown;
        try {
          payload = await evolutionRequest(`/instance/connect/${encodeURIComponent(instanceName)}`);
        } catch (error) {
          // Se a primeira criação falhou antes de alcançar a Evolution, a linha local permanece
          // como trilha de erro. "Reconectar" também sabe criar o recurso remoto ausente.
          if (!(error instanceof EvolutionApiError) || error.status !== 404) throw error;
          payload = await evolutionRequest("/instance/create", {
            method: "POST",
            body: JSON.stringify(payloadCriacao(instanceName)),
          });
        }
        await configurarWebhook(instanceName);
        const estado = estadoDoPayload(payload);
        await atualizarSnapshot(userClient, row.id, estado, true);
        return json(200, {
          instancia: mapInstancia({ ...row, webhook_registrado: true }, estado, null),
          qrCode: estado.qrCode,
        }, cors);
      } catch (error) {
        await marcarErro(userClient, row.id);
        throw error;
      }
    }

    await evolutionRequest(`/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
    });
    const estado: EstadoRemoto = {
      status: "desconectado",
      numeroVinculado: null,
      qrCode: null,
    };
    await atualizarSnapshot(userClient, row.id, estado);
    return json(200, { instancia: mapInstancia(row, estado, null) }, cors);
  } catch (error) {
    if (error instanceof HttpError) return problem(error.status, error.message, reqId, cors);
    if (error instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        nivel: "error",
        fn: FN,
        reqId,
        msg: "erro inesperado",
        detail: String(error),
      }),
    );
    return problem(502, mensagemSegura(error), reqId, cors);
  }
});

async function buscarInstancia(
  userClient: UntypedSupabaseClient,
  id: string,
): Promise<CanalRow> {
  const { data, error } = await userClient
    .schema("atendimento")
    .from("canais_externos")
    .select("id,label,identificador_externo,numero_vinculado,status_conexao,webhook_registrado,ativo")
    .eq("id", id)
    .eq("tipo", "evolution")
    .eq("ativo", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Instância Evolution não encontrada");
  return data as CanalRow;
}

async function exigirEscritaInstancia(
  userClient: UntypedSupabaseClient,
  row: CanalRow,
  userId: string,
): Promise<void> {
  const { data, error } = await userClient
    .schema("atendimento")
    .from("canais_externos")
    .update({ status_conexao: row.status_conexao, updated_by: userId })
    .eq("id", row.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(403, "atendimento:escrita obrigatório");
}

async function consultarEstado(instanceName: string): Promise<EstadoRemoto> {
  if (!instanceName) throw new Error("Instância sem Instance ID");
  const payload = await evolutionRequest(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
  );
  const estado = estadoDoPayload(payload);
  if (estado.status !== "conectado" || estado.numeroVinculado) return estado;

  // connectionState costuma devolver apenas open/close. fetchInstances contém ownerJid, usado
  // para exibir o número realmente vinculado (AC-2). Falha nesta consulta auxiliar não transforma
  // uma conexão comprovadamente aberta em erro.
  try {
    const detalhes = await evolutionRequest(
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
    );
    return { ...estado, numeroVinculado: extrairNumero(detalhes) };
  } catch {
    return estado;
  }
}

async function evolutionRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const baseUrl = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/+$/, "");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";
  if (!baseUrl || !apiKey) throw new Error("EVOLUTION_API_URL/EVOLUTION_API_KEY ausentes");

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new EvolutionApiError(response.status);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function configuracaoWebhook() {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const token = Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") ??
    Deno.env.get("EVOLUTION_HMAC_SECRET") ?? "";
  return criarConfiguracaoWebhook(supabaseUrl, token);
}

function payloadCriacao(instanceName: string) {
  return criarPayloadInstancia(
    instanceName,
    Deno.env.get("EVOLUTION_INTEGRATION") ?? "WHATSAPP-BAILEYS",
    configuracaoWebhook(),
  );
}

async function configurarWebhook(instanceName: string): Promise<void> {
  await evolutionRequest(`/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ webhook: configuracaoWebhook() }),
  });
}

function estadoDoPayload(payload: unknown): EstadoRemoto {
  const obj = (payload ?? {}) as Record<string, unknown>;
  const instance = (obj.instance ?? {}) as Record<string, unknown>;
  const qrcode = (obj.qrcode ?? {}) as Record<string, unknown>;
  const state = String(instance.state ?? obj.state ?? "").toLowerCase();
  const ownerJid = String(instance.ownerJid ?? obj.ownerJid ?? "");
  const numeroVinculado = ownerJid ? ownerJid.split("@")[0] : null;
  const base64 = String(qrcode.base64 ?? obj.base64 ?? "");
  const code = String(qrcode.code ?? obj.code ?? "");
  const qrCode = base64
    ? base64.startsWith("data:image")
      ? base64
      : `data:image/png;base64,${base64}`
    : code || null;
  return {
    status: state === "open" || state === "connected" ? "conectado" : "desconectado",
    numeroVinculado,
    qrCode,
  };
}

function extrairNumero(payload: unknown): string | null {
  const primeiro = Array.isArray(payload) ? payload[0] : payload;
  const obj = (primeiro ?? {}) as Record<string, unknown>;
  const instance = (obj.instance ?? {}) as Record<string, unknown>;
  const ownerJid = String(instance.ownerJid ?? obj.ownerJid ?? "");
  return ownerJid ? ownerJid.split("@")[0] : null;
}

async function atualizarSnapshot(
  userClient: UntypedSupabaseClient,
  id: string,
  estado: EstadoRemoto,
  webhookRegistrado?: boolean,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status_conexao: estado.status,
    numero_vinculado: estado.numeroVinculado,
    updated_at: new Date().toISOString(),
  };
  if (webhookRegistrado !== undefined) patch.webhook_registrado = webhookRegistrado;
  const { error } = await userClient
    .schema("atendimento")
    .from("canais_externos")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

async function marcarErro(
  userClient: UntypedSupabaseClient,
  id: string,
): Promise<void> {
  await userClient
    .schema("atendimento")
    .from("canais_externos")
    .update({ status_conexao: "erro", updated_at: new Date().toISOString() })
    .eq("id", id);
}

function mapInstancia(row: CanalRow, estado: EstadoRemoto, erro: string | null) {
  return {
    id: row.id,
    label: row.label,
    instanceName: row.identificador_externo ?? "",
    numeroVinculado: estado.numeroVinculado,
    status: estado.status,
    webhookRegistrado: row.webhook_registrado,
    ativo: row.ativo,
    erro,
  };
}

function mensagemSegura(error: unknown): string {
  const mensagem = error instanceof Error ? error.message : String(error);
  if (mensagem.includes("EVOLUTION_API_")) return mensagem;
  if (mensagem.startsWith("Evolution API respondeu")) return mensagem;
  if (mensagem.includes("timed out") || mensagem.includes("Timeout")) {
    return "Evolution API não respondeu a tempo";
  }
  return "Não foi possível acessar a Evolution API";
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function problem(
  status: number,
  detail: string,
  reqId: string,
  cors: Record<string, string>,
): Response {
  const titles: Record<number, string> = {
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
    502: "Bad Gateway",
  };
  return new Response(
    JSON.stringify({
      type: "about:blank",
      title: titles[status] ?? "Error",
      status,
      detail,
      reqId,
    }),
    {
      status,
      headers: { "Content-Type": "application/problem+json", ...cors },
    },
  );
}
