// pcm-api-dominio — E01-S198 (BL 014). Contrato versionado, único caminho externo pro staging.
// ADR-1695: "desenhar agora, implementar por etapas" (spec, P2) — esta etapa cobre só
// `levantamento.*` (E01-S178, 0315/0318), reusando as RPCs existentes sem reescrevê-las. FR-007:
// não cria um segundo mecanismo de staging — é uma fachada versionada em cima do que já existe.
//
// AS CINCO CAMADAS (AC-9), em toda ação, sem exceção — ver `scripts/check-api-dominio-cinco-camadas.mjs`:
//   1. Autenticação  — `requireAuth` (_shared/auth.ts), igual a toda função que recebe usuário.
//   2. Autorização    — herdada da RPC de domínio (`config.sso_autorizar_acao`), nunca reimplementada
//                       aqui (Assumptions da spec: "a API herda a autorização, não cria a sua").
//   3. Validação      — Zod por ação, shape idêntico ao que a RPC já valida (defesa em profundidade,
//                       não confia só na borda).
//   4. Idempotência   — `requestId` obrigatório em toda ação de escrita, repassado à RPC (que já
//                       audita 40-tipo diferente e-conflito por request_id).
//   5. Auditoria       — herdada da RPC (`audit.events`), nunca duplicada aqui.
//
// AC-8: NENHUMA ação aqui aceita SQL livre, nome de tabela/coluna dinâmico ou filtro arbitrário —
// cada ação é um nome fixo mapeado 1:1 pra uma RPC também fixa, com assinatura fixa. O guard de
// CI falha o build se esse arquivo alguma vez ganhar `.sql(` ou `rpc(` com nome vindo de variável.
//
// SPEC_DEVIATION (ver plan.md): `levantamento.aprovar`/`rejeitar` ficam pra próxima etapa — a RPC
// real (`sso_aprovar_linhas_parcialmente`, 0883) está com EXECUTE revogado de `authenticated` e
// atrás de dois gates fechados; expor isso pela API exigiria decidir a reabertura primeiro, fora
// do escopo desta story (abertura de gate é ato humano separado, mesmo padrão de outras stories
// desta sessão).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";

const FN = "pcm-api-dominio";
const VERSAO_SUPORTADA = "v1";

const LinhaSchema = z
  .object({
    chave: z.string().trim().min(1).max(200),
    tipo: z.enum(["area", "local", "sublocal", "sistema", "equipamento", "componente", "grupo_quantitativo"]),
    atributos: z.record(z.unknown()),
  })
  .strict();

const EnvelopeSchema = z.object({
  versao: z.literal(VERSAO_SUPORTADA),
  acao: z.enum(["levantamento.criar_lote", "levantamento.consultar_previa"]),
  requestId: z.string().uuid().optional(),
  clienteId: z.string().uuid(),
  payload: z.record(z.unknown()),
});

const CriarLotePayloadSchema = z
  .object({
    origem: z.enum(["planilha", "auvo", "campo"]),
    chaveOrigem: z.string().trim().min(1).max(200),
    linhas: z.array(LinhaSchema).min(1).max(1000),
  })
  .strict();

const ConsultarPreviaPayloadSchema = z
  .object({
    loteId: z.string().uuid(),
    apos: z.string().max(200).nullable().optional(),
    limite: z.number().int().min(1).max(100).default(50),
  })
  .strict();

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const reqId = crypto.randomUUID().slice(0, 8);

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    // Camada 1 — autenticação.
    await requireAuth(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    if (!url) throw new HttpError(500, "Ambiente Supabase incompleto");
    // Client no contexto do USUÁRIO (anon key + Authorization repassado) — nunca service_role.
    // É o que faz `auth.uid()`/`config.sso_autorizar_acao` dentro da RPC (camada 2) ser o ator
    // real, e garante o isolamento de Cliente (AC-10) por RLS, não por filtro desta borda.
    // biome-ignore lint/suspicious/noExplicitAny: schemas Supabase não têm tipos gerados no repo.
    const db: any = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Camada 3 — validação do envelope.
    const envelope = EnvelopeSchema.parse(await req.json());
    if (envelope.versao !== VERSAO_SUPORTADA) {
      throw new HttpError(400, `Versão não suportada. Use "${VERSAO_SUPORTADA}".`);
    }

    if (envelope.acao === "levantamento.criar_lote") {
      // Camada 4 — idempotência obrigatória em ação de escrita.
      if (!envelope.requestId) throw new HttpError(422, "requestId é obrigatório para criar lote.");
      const corpo = CriarLotePayloadSchema.parse(envelope.payload);
      const { data, error } = await db.schema("pcm").rpc("sso_receber_levantamento", {
        p_request_id: envelope.requestId,
        p_cliente_id: envelope.clienteId,
        p_origem: corpo.origem,
        p_chave_origem: corpo.chaveOrigem,
        p_linhas: corpo.linhas,
      });
      if (error) throw mapErroDominio(error);
      console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, acao: envelope.acao, clienteId: envelope.clienteId }));
      return json(200, data, cors);
    }

    if (envelope.acao === "levantamento.consultar_previa") {
      const corpo = ConsultarPreviaPayloadSchema.parse(envelope.payload);
      const [{ data: linhas, error: linhasError }, { data: lote, error: loteError }] = await Promise.all([
        db.schema("pcm").rpc("sso_listar_linhas_levantamento", {
          p_cliente_id: envelope.clienteId,
          p_lote_id: corpo.loteId,
          p_limite: corpo.limite,
          p_apos: corpo.apos ?? null,
        }),
        db.schema("pcm").rpc("sso_listar_levantamentos", {
          p_cliente_id: envelope.clienteId,
          p_limite: 1,
          p_apos: null,
        }),
      ]);
      if (linhasError) throw mapErroDominio(linhasError);
      if (loteError) throw mapErroDominio(loteError);
      console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, acao: envelope.acao, clienteId: envelope.clienteId }));
      return json(200, { linhas, lotes: lote }, cors);
    }

    throw new HttpError(400, "Ação não suportada.");
  } catch (error) {
    if (error instanceof HttpError) return problem(error.status, error.message, reqId, cors);
    if (error instanceof z.ZodError) return problem(422, "Entrada inválida para esta ação.", reqId, cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(error) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

/** Traduz os erros nomeados da RPC (camada 2/3 já aplicadas lá dentro) pro HTTP status certo —
 * sem isso, qualquer recusa de domínio viraria 500 genérico pro consumidor externo. */
function mapErroDominio(error: { message?: string }): HttpError {
  const msg = error.message ?? "";
  if (msg.includes("sem_acesso") || msg.includes("nao_encontrado_ou_sem_acesso")) {
    return new HttpError(403, "Sem acesso a este Cliente ou recurso.");
  }
  if (msg.includes("request_id_conflitante")) {
    return new HttpError(409, "Mesmo requestId com dados diferentes — recarregue e repita.");
  }
  if (msg.includes("invalida") || msg.includes("invalido")) {
    return new HttpError(422, "Dados inválidos para esta ação.");
  }
  return new HttpError(500, "Erro interno");
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ type: "about:blank", title: "Error", status, detail, reqId }), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
