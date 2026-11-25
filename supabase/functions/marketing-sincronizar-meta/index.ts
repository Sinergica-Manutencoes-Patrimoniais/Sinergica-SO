// marketing-sincronizar-meta — E06-S01 (ADR-1699).
//
// Traz a hierarquia e os números diários da conta de anúncios para o schema `marketing`.
// Camadas, na ordem obrigatória: CORS → requireAuth (JWT) → Zod → autorização → lógica →
// resposta. Erro em problem+json com reqId, sem stack.
//
// TRÊS DECISÕES QUE NÃO SÃO DETALHE:
//
// 1. JANELA DE REPROCESSAMENTO, não "sincronizar o que é novo". A Meta revisa números
//    retroativamente (atribuição tardia, remoção de clique fraudulento). Sincronizar só ontem
//    produz um relatório que diverge do Gerenciador de Anúncios, e a partir daí ninguém confia
//    na tela. Toda rodada reprocessa os últimos N dias (padrão 7) com upsert.
// 2. CREDENCIAL SÓ AQUI. O token sai do Vault por `marketing.fn_token_meta()`, que só
//    `service_role` executa. O navegador nunca o vê, nem o seu indício.
// 3. SEM CREDENCIAL, MODO DEMONSTRAÇÃO QUE SE ANUNCIA. A resposta carrega `origem` e o mesmo
//    valor vai para `marketing.sincronizacoes`. Dado de exemplo apresentado como real seria pior
//    do que tela vazia.
//
// FORA DE ESCOPO, VINCULANTE: esta função não escreve nada na Meta. A porta `MetaAdsPort` não
// declara operação de escrita (FR-017 da spec).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import {
  FalhaMetaAds,
  type MetaAdsPort,
  criarMetaAdsFixture,
  criarMetaAdsHttp,
} from "../_shared/marketing/meta-ads.ts";
import fixtureDemonstracao from "../_shared/marketing/fixtures/conta-demonstracao.json" with {
  type: "json",
};

const FN = "marketing-sincronizar-meta";
const JANELA_PADRAO = 7;

const InputSchema = z.object({
  contaId: z.string().uuid(),
  janelaDias: z.number().int().min(1).max(90).optional(),
});

type Origem = "meta" | "demonstracao";

interface Contagens {
  campanhas: number;
  conjuntos: number;
  anuncios: number;
  metricas: number;
}

function log(nivel: "info" | "error", reqId: string, dados: Record<string, unknown>) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), nivel, fn: FN, reqId, ...dados }),
  );
}

function dia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  log("info", reqId, { method: req.method });

  // Declarados aqui para o `catch` conseguir registrar a execução que falhou (AC-11).
  let admin: UntypedSupabaseClient | null = null;
  let contaId: string | null = null;
  let janela: { de: string; ate: string } | null = null;
  let origem: Origem = "demonstracao";

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não suportado");

    // 1) Autenticação — identidade nunca vem do body.
    const { userId } = await requireAuth(req);

    // 2) Validação na borda.
    const input = InputSchema.parse(await req.json());
    contaId = input.contaId;
    const janelaDias = input.janelaDias ?? JANELA_PADRAO;

    // 3) Autorização NO SERVIDOR (AC-12). A UI já esconde o botão, mas esconder não é proteger:
    //    quem chama a função direto tem que esbarrar aqui.
    const comoUsuario = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      },
    ) as UntypedSupabaseClient;
    // `config.minhas_permissoes` é a mesma fonte que a UI lê (E00-S09): view `security_invoker`
    // sobre o resolvedor, logo responde para o usuário da sessão, não para o servidor.
    const { data: permissoes } = await comoUsuario
      .schema("config")
      .from("minhas_permissoes")
      .select("modulo,nivel");
    const temEscrita = (permissoes ?? []).some(
      (p: { modulo: string; nivel: string }) => p.modulo === "marketing" && p.nivel === "escrita",
    );
    // Superadmin nao aparece na view por desenho (`resolver_permissoes_modulo` retorna vazio
    // para ele — 0008_E00-S09): quem tem tudo nao e listado modulo a modulo. Sem este segundo
    // ramo, o superadmin seria o unico a nao conseguir sincronizar.
    const { data: perfil } = await comoUsuario
      .schema("config")
      .from("usuarios")
      .select("papel")
      .eq("user_id", userId)
      .maybeSingle();
    const ehSuperadmin = (perfil as { papel?: string } | null)?.papel === "superadmin";
    if (!temEscrita && !ehSuperadmin) {
      throw new HttpError(403, "Sem permissão de escrita no módulo Marketing");
    }

    admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      getSupabaseServiceKey(),
    ) as UntypedSupabaseClient;

    const { data: conta } = await admin
      .schema("marketing")
      .from("contas_anuncio")
      .select("id,conta_externa_id,ativa")
      .eq("id", contaId)
      .maybeSingle();
    if (!conta || !conta.ativa) throw new HttpError(404, "Conta de anúncios inexistente ou inativa");

    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setUTCDate(inicio.getUTCDate() - (janelaDias - 1));
    janela = { de: dia(inicio), ate: dia(hoje) };

    // 4) Porta: credencial presente manda na escolha, não uma variável de ambiente que alguém
    //    esquece de trocar. Ausente = demonstração declarada (AC-10).
    const { data: token } = await admin.schema("marketing").rpc("fn_token_meta");
    const tokenMeta = typeof token === "string" && token.length > 0 ? token : null;
    origem = tokenMeta ? "meta" : "demonstracao";
    const porta: MetaAdsPort = tokenMeta
      ? criarMetaAdsHttp(tokenMeta)
      : criarMetaAdsFixture(fixtureDemonstracao);

    const contagens = await sincronizar(admin, porta, conta.id, conta.conta_externa_id, janela);

    const { data: registro } = await admin
      .schema("marketing")
      .from("sincronizacoes")
      .insert({
        conta_id: conta.id,
        janela_de: janela.de,
        janela_ate: janela.ate,
        origem,
        resultado: "sucesso",
        campanhas: contagens.campanhas,
        conjuntos: contagens.conjuntos,
        anuncios: contagens.anuncios,
        metricas: contagens.metricas,
      })
      .select("id")
      .single();

    await admin
      .schema("marketing")
      .from("contas_anuncio")
      .update({ sincronizada_em: new Date().toISOString() })
      .eq("id", conta.id);

    log("info", reqId, { userId, origem, janela, contagens });

    return json(
      200,
      {
        sincronizacaoId: registro?.id ?? null,
        origem,
        janela,
        gravados: contagens,
      },
      cors,
    );
  } catch (e) {
    const codigo =
      e instanceof FalhaMetaAds
        ? e.codigo
        : e instanceof HttpError
          ? `http_${e.status}`
          : e instanceof z.ZodError
            ? "input_invalido"
            : "erro_inesperado";

    // AC-11: a execução que falhou também fica registrada — é o que permite descobrir depois
    // que o relatório está velho porque a credencial expirou, e não porque ninguém anunciou.
    if (admin && janela && contaId) {
      await admin
        .schema("marketing")
        .from("sincronizacoes")
        .insert({
          conta_id: contaId,
          janela_de: janela.de,
          janela_ate: janela.ate,
          origem,
          resultado: "falha",
          // Só o código. O corpo da resposta da Meta pode refletir o token de volta.
          detalhe: codigo,
        })
        .then(
          () => undefined,
          () => undefined,
        );
    }

    log("error", reqId, { codigo });

    if (e instanceof FalhaMetaAds) return problem(502, `Meta: ${e.codigo}`, reqId, cors);
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    return problem(500, "Erro interno", reqId, cors);
  }
});

/** Upsert da hierarquia e das métricas. Idempotente por construção: a hierarquia pela chave
 * natural de cada nível, as métricas por `(anuncio_id, dia)`. Rodar duas vezes a mesma janela
 * não cria linha nova (AC-9). */
async function sincronizar(
  admin: UntypedSupabaseClient,
  porta: MetaAdsPort,
  contaId: string,
  contaExternaId: string,
  janela: { de: string; ate: string },
): Promise<Contagens> {
  const mkt = admin.schema("marketing");
  const hierarquia = await porta.hierarquia(contaExternaId);

  const { data: campanhas } = await mkt
    .from("campanhas")
    .upsert(
      hierarquia.campanhas.map((c) => ({
        conta_id: contaId,
        campanha_externa_id: c.campanhaExternaId,
        nome: c.nome,
        objetivo: c.objetivo,
        situacao: c.situacao,
        atualizado_em: new Date().toISOString(),
      })),
      { onConflict: "conta_id,campanha_externa_id" },
    )
    .select("id,campanha_externa_id");
  const idDaCampanha = new Map<string, string>(
    (campanhas ?? []).map((c: { id: string; campanha_externa_id: string }) => [
      c.campanha_externa_id,
      c.id,
    ]),
  );

  const { data: conjuntos } = await mkt
    .from("conjuntos")
    .upsert(
      hierarquia.conjuntos
        .filter((c) => idDaCampanha.has(c.campanhaExternaId))
        .map((c) => ({
          campanha_id: idDaCampanha.get(c.campanhaExternaId),
          conjunto_externo_id: c.conjuntoExternoId,
          nome: c.nome,
          situacao: c.situacao,
          atualizado_em: new Date().toISOString(),
        })),
      { onConflict: "campanha_id,conjunto_externo_id" },
    )
    .select("id,conjunto_externo_id");
  const idDoConjunto = new Map<string, string>(
    (conjuntos ?? []).map((c: { id: string; conjunto_externo_id: string }) => [
      c.conjunto_externo_id,
      c.id,
    ]),
  );

  const { data: anuncios } = await mkt
    .from("anuncios")
    .upsert(
      hierarquia.anuncios
        .filter((a) => idDoConjunto.has(a.conjuntoExternoId))
        .map((a) => ({
          conjunto_id: idDoConjunto.get(a.conjuntoExternoId),
          anuncio_externo_id: a.anuncioExternoId,
          nome: a.nome,
          situacao: a.situacao,
          atualizado_em: new Date().toISOString(),
        })),
      { onConflict: "anuncio_externo_id" },
    )
    .select("id,anuncio_externo_id");
  const idDoAnuncio = new Map<string, string>(
    (anuncios ?? []).map((a: { id: string; anuncio_externo_id: string }) => [
      a.anuncio_externo_id,
      a.id,
    ]),
  );

  const numeros = await porta.numerosDiarios(contaExternaId, janela.de, janela.ate);
  const linhas = numeros
    .filter((n) => idDoAnuncio.has(n.anuncioExternoId))
    .map((n) => ({
      anuncio_id: idDoAnuncio.get(n.anuncioExternoId),
      dia: n.dia,
      gasto_centavos: n.gastoCentavos,
      alcance: n.alcance,
      impressoes: n.impressoes,
      cliques: n.cliques,
      leads: n.leads,
      atualizado_em: new Date().toISOString(),
    }));

  if (linhas.length > 0) {
    const { error } = await mkt
      .from("metricas_anuncio_dia")
      .upsert(linhas, { onConflict: "anuncio_id,dia" });
    if (error) throw new HttpError(500, "Falha ao gravar métricas");
  }

  return {
    campanhas: idDaCampanha.size,
    conjuntos: idDoConjunto.size,
    anuncios: idDoAnuncio.size,
    metricas: linhas.length,
  };
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
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
    502: "Bad Gateway",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
