// pcm-mcp — E02-S43 (BL 015). MCP controlado: ferramentas nomeadas, nunca SQL genérico, sempre
// pela API de domínio (`pcm-api-dominio`, E01-S198) — NUNCA acesso direto ao banco (AC-2). Este
// arquivo propositalmente NÃO importa nenhum client Supabase com acesso a `schema("pcm")`; a
// única forma de tocar dado é `fetch` pra `pcm-api-dominio`, repassando o Authorization do
// usuário real — é isso que faz AC-7 ("texto não concede capacidade") e AC-9 (revogação
// imediata) funcionarem: a autorização roda inteira do lado de lá, nunca aqui.
//
// Protocolo: subconjunto mínimo de JSON-RPC 2.0 do MCP — `initialize`, `tools/list`, `tools/call`.
//
// SPEC_DEVIATION (ver plan.md): só leitura nesta etapa (US1) — "a primeira entrega é leitura;
// escrita vem depois e apenas em staging, com confirmação" (Contexto da própria spec). Escrita
// exigiria um fluxo de proposta+confirmação que ainda não existe em `pcm-api-dominio` (que hoje
// só tem `levantamento.criar_lote`, sem um passo de confirmação separado) — próxima etapa.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";

const FN = "pcm-mcp";

// AC-3/AC-8: catálogo FECHADO e nomeado — adicionar ferramenta é editar este array, nunca um
// nome vindo de fora. Cada ferramenta mapeia pra UMA ação fixa de `pcm-api-dominio`.
const FERRAMENTAS = {
  consultar_levantamento: {
    descricao: "Consulta a prévia de um lote de levantamento em staging (nunca o cadastro oficial).",
    acaoDominio: "levantamento.consultar_previa",
    schema: z
      .object({
        clienteId: z.string().uuid(),
        loteId: z.string().uuid(),
        limite: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
  },
} as const;
type NomeFerramenta = keyof typeof FERRAMENTAS;

const JsonRpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.enum(["initialize", "tools/list", "tools/call"]),
  params: z.record(z.unknown()).optional(),
});

const ToolsCallParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()).default({}),
});

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const reqId = crypto.randomUUID().slice(0, 8);
  let rpcId: string | number | null = null;

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    // Camada 1 — autenticação. Falha aqui NUNCA chega a chamar nenhuma ferramenta.
    await requireAuth(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    if (!url) throw new HttpError(500, "Ambiente Supabase incompleto");

    const entrada = JsonRpcSchema.parse(await req.json());
    rpcId = entrada.id ?? null;

    if (entrada.method === "initialize") {
      return jsonRpc(rpcId, { protocolVersion: "2026-06-18", serverInfo: { name: FN, version: "v1" }, capabilities: { tools: {} } }, cors);
    }

    if (entrada.method === "tools/list") {
      const tools = Object.entries(FERRAMENTAS).map(([nome, def]) => ({
        name: nome,
        description: def.descricao,
        inputSchema: { type: "object" },
      }));
      return jsonRpc(rpcId, { tools }, cors);
    }

    // tools/call
    const chamada = ToolsCallParamsSchema.parse(entrada.params ?? {});
    // AC-7/AC-8: nome de ferramenta fora do catálogo fechado é recusado ANTES de qualquer
    // chamada remota — uma IA adversarial não inventa ferramenta nova só pedindo.
    if (!(chamada.name in FERRAMENTAS)) {
      await registrarUso(url, req, chamada.name, false, "ferramenta_desconhecida");
      throw new HttpError(404, `Ferramenta "${chamada.name}" não existe no catálogo controlado.`);
    }
    const nome = chamada.name as NomeFerramenta;
    const definicao = FERRAMENTAS[nome];

    let argumentos: z.infer<(typeof FERRAMENTAS)[NomeFerramenta]["schema"]>;
    try {
      argumentos = definicao.schema.parse(chamada.arguments);
    } catch {
      await registrarUso(url, req, nome, false, "argumentos_invalidos");
      throw new HttpError(422, "Argumentos inválidos para esta ferramenta.");
    }

    // AC-2: a ÚNICA chamada que toca dado é esta — pra `pcm-api-dominio`, nunca ao banco direto.
    // Repassa o Authorization do usuário real: é o servidor de lá (não este) que decide
    // autorização (AC-7) e aplica isolamento de Cliente (AC-1) e revogação (AC-9).
    const resposta = await fetch(`${url}/functions/v1/pcm-api-dominio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.get("Authorization") ?? "",
      },
      body: JSON.stringify({
        versao: "v1",
        acao: definicao.acaoDominio,
        clienteId: argumentos.clienteId,
        payload: { loteId: argumentos.loteId, limite: argumentos.limite },
      }),
    });
    const corpo = await resposta.json().catch(() => null);
    const sucesso = resposta.ok;
    await registrarUso(url, req, nome, sucesso, sucesso ? null : `status_${resposta.status}`);
    if (!sucesso) {
      throw new HttpError(resposta.status, (corpo as { detail?: string })?.detail ?? "Ferramenta recusada pela API de domínio.");
    }
    console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, ferramenta: nome }));
    return jsonRpc(rpcId, { content: [{ type: "text", text: JSON.stringify(corpo) }] }, cors);
  } catch (error) {
    if (error instanceof HttpError) return jsonRpcErro(rpcId, error.status, error.message, cors);
    if (error instanceof z.ZodError) return jsonRpcErro(rpcId, 422, "Entrada inválida.", cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(error) }));
    return jsonRpcErro(rpcId, 500, "Erro interno", cors);
  }
});

/** AC-6/AC-10: registra toda chamada (sucesso ou recusa) no contexto do usuário real — nunca
 * deixa passar silenciosamente, nunca duplica efeito (é só um log, idempotência de efeito real
 * já é da ação de domínio chamada, não deste registro). Falha ao registrar nunca derruba a
 * resposta da ferramenta — log é auditoria, não é a operação principal. */
async function registrarUso(url: string, req: Request, ferramenta: string, sucesso: boolean, detalhe: string | null): Promise<void> {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: schemas Supabase não têm tipos gerados no repo.
    const dbUsuario: any = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    await dbUsuario.schema("pcm").rpc("sso_registrar_uso_mcp", {
      p_ferramenta: ferramenta,
      p_sucesso: sucesso,
      p_detalhe: detalhe,
    });
  } catch {
    // Auditoria best-effort — nunca interrompe a resposta da ferramenta por isso.
  }
}

function jsonRpc(id: string | number | null, result: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function jsonRpcErro(id: string | number | null, status: number, message: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000 - status, message } }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
