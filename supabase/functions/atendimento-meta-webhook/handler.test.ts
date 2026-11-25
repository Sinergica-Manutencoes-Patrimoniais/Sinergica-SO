import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assinaturaEsperada, criarHandler } from "./index.ts";

const CANAL_ID = "11111111-1111-1111-1111-111111111111";
const CONTA = "17841400000000000";
const APP_SECRET = "segredo-do-app-daquele-canal";
const VERIFY_TOKEN = "verify-token-daquele-canal";
const BASE = `https://projeto.supabase.co/functions/v1/atendimento-meta-webhook/${CANAL_ID}`;

interface Config {
  canal?: { id: string; identificador_externo: string | null; ativo: boolean } | null;
  metaCanal?: Record<string, unknown> | null;
  segredos?: Record<string, string | null>;
  rateLimitPermitido?: boolean;
  registrarResultado?: { data: unknown; error: unknown };
}

function clienteFake(cfg: Config) {
  const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const cliente = {
    schema(_s: string) {
      return {
        from(tabela: string) {
          const cadeia = {
            select: () => cadeia,
            eq: () => cadeia,
            in: () => cadeia,
            maybeSingle: async () => {
              if (tabela === "canais_externos") {
                return {
                  data:
                    cfg.canal === undefined
                      ? { id: CANAL_ID, identificador_externo: CONTA, ativo: true }
                      : cfg.canal,
                  error: null,
                };
              }
              if (tabela === "meta_canal") {
                return {
                  data:
                    cfg.metaCanal === undefined
                      ? {
                          conta_externa_id: CONTA,
                          app_secret_ref: "SINERGICA_METASECRET_1_ref",
                          token_ref: "SINERGICA_METATOKEN_1_ref",
                          verify_token_ref: "SINERGICA_METAVERIFY_1_ref",
                          graph_version: "v22.0",
                          estado: "conectado",
                        }
                      : cfg.metaCanal,
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          };
          return cadeia;
        },
        rpc: async (fn: string, args: Record<string, unknown>) => {
          chamadas.push({ fn, args });
          if (fn === "fn_ler_segredo_referenciado") {
            const mapa = cfg.segredos ?? {
              SINERGICA_METASECRET_1_ref: APP_SECRET,
              SINERGICA_METAVERIFY_1_ref: VERIFY_TOKEN,
              SINERGICA_METATOKEN_1_ref: "token-de-pagina",
            };
            return { data: mapa[String(args.p_ref)] ?? null, error: null };
          }
          if (fn === "fn_consumir_rate_limit_webhook") {
            return { data: cfg.rateLimitPermitido ?? true, error: null };
          }
          if (fn === "fn_registrar_mensagem_meta") {
            return (
              cfg.registrarResultado ?? {
                data: [{ mensagem_id: "msg-1", conversa_id: "conv-1", duplicado: false }],
                error: null,
              }
            );
          }
          return { data: null, error: null };
        },
      };
    },
  };
  // deno-lint-ignore no-explicit-any
  return { serviceClient: cliente as any, chamadas };
}

const PAYLOAD_DIRECT = {
  object: "instagram",
  entry: [
    {
      id: CONTA,
      messaging: [{ sender: { id: "123" }, message: { mid: "m1", text: "oi, quanto custa?" } }],
    },
  ],
};

async function postar(
  handler: (req: Request) => Promise<Response>,
  payload: unknown,
  opcoes: { assinatura?: string; url?: string; contentType?: string } = {},
) {
  const corpo = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(corpo);
  const assinatura = opcoes.assinatura ?? (await assinaturaEsperada(APP_SECRET, bytes));
  return handler(
    new Request(opcoes.url ?? BASE, {
      method: "POST",
      headers: {
        "content-type": opcoes.contentType ?? "application/json",
        "x-hub-signature-256": assinatura,
      },
      body: corpo,
    }),
  );
}

Deno.test("recusa método que não é GET nem POST", async () => {
  const { serviceClient } = clienteFake({});
  const resposta = await criarHandler({ serviceClient })(new Request(BASE, { method: "DELETE" }));
  assertEquals(resposta.status, 405);
});

Deno.test("sem canal no caminho: 404, mesmo com assinatura boa", async () => {
  const { serviceClient } = clienteFake({});
  const resposta = await postar(criarHandler({ serviceClient }), PAYLOAD_DIRECT, {
    url: "https://projeto.supabase.co/functions/v1/atendimento-meta-webhook",
  });
  assertEquals(resposta.status, 404);
  assertEquals((await resposta.json()).codigo, "canal_nao_identificado");
});

Deno.test("canal desativado responde o mesmo 404 de canal inexistente", async () => {
  const { serviceClient } = clienteFake({
    canal: { id: CANAL_ID, identificador_externo: CONTA, ativo: false },
  });
  const resposta = await postar(criarHandler({ serviceClient }), PAYLOAD_DIRECT);
  assertEquals(resposta.status, 404);
});

Deno.test("canal sem credencial no Vault responde 503, não aceita o evento", async () => {
  const { serviceClient } = clienteFake({ metaCanal: null });
  const resposta = await postar(criarHandler({ serviceClient }), PAYLOAD_DIRECT);
  assertEquals(resposta.status, 503);
  assertEquals((await resposta.json()).codigo, "sem_credencial");
});

Deno.test("assinatura de OUTRO app secret é recusada com 401 e nada é gravado", async () => {
  const { serviceClient, chamadas } = clienteFake({});
  const corpo = JSON.stringify(PAYLOAD_DIRECT);
  const assinaturaAlheia = await assinaturaEsperada(
    "segredo-de-outro-canal",
    new TextEncoder().encode(corpo),
  );
  const resposta = await postar(criarHandler({ serviceClient }), PAYLOAD_DIRECT, {
    assinatura: assinaturaAlheia,
  });
  assertEquals(resposta.status, 401);
  assertEquals((await resposta.json()).codigo, "recusado");
  assertEquals(chamadas.some((c) => c.fn === "fn_registrar_mensagem_meta"), false);
  // Rate limit também não é consumido antes da assinatura — um forjador não derruba o canal.
  assertEquals(chamadas.some((c) => c.fn === "fn_consumir_rate_limit_webhook"), false);
});

Deno.test("sem cabeçalho de assinatura: 401", async () => {
  const { serviceClient } = clienteFake({});
  const resposta = await criarHandler({ serviceClient })(
    new Request(BASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(PAYLOAD_DIRECT),
    }),
  );
  assertEquals(resposta.status, 401);
});

Deno.test("content-type que não é JSON: 415", async () => {
  const { serviceClient } = clienteFake({});
  const resposta = await postar(criarHandler({ serviceClient }), PAYLOAD_DIRECT, {
    contentType: "text/plain",
  });
  assertEquals(resposta.status, 415);
});

Deno.test("Direct de texto válido grava pela RPC por canal, com o canal da ROTA", async () => {
  const { serviceClient, chamadas } = clienteFake({});
  const resposta = await postar(criarHandler({ serviceClient }), PAYLOAD_DIRECT);
  assertEquals(resposta.status, 200);
  assertEquals(await resposta.json(), { ok: true, gravados: 1, duplicados: 0, ignorados: 0 });

  const registro = chamadas.find((c) => c.fn === "fn_registrar_mensagem_meta");
  assertEquals(registro?.args.p_canal_id, CANAL_ID);
  assertEquals(registro?.args.p_canal, "instagram");
  assertEquals(registro?.args.p_remote_jid, "123");
  assertEquals(registro?.args.p_remote_id, "m1");
  assertEquals(registro?.args.p_event_type, "instagram.messaging");
});

Deno.test("evento de OUTRA conta não cai neste canal: 409 canal_divergente", async () => {
  const { serviceClient, chamadas } = clienteFake({});
  const resposta = await postar(criarHandler({ serviceClient }), {
    object: "instagram",
    entry: [
      {
        id: "17849999999999999",
        messaging: [{ sender: { id: "123" }, message: { mid: "m1", text: "oi" } }],
      },
    ],
  });
  assertEquals(resposta.status, 409);
  assertEquals(chamadas.some((c) => c.fn === "fn_registrar_mensagem_meta"), false);
});

Deno.test("reentrega da Meta responde duplicado, sem segunda bolha", async () => {
  const { serviceClient } = clienteFake({
    registrarResultado: { data: [{ mensagem_id: null, conversa_id: null, duplicado: true }], error: null },
  });
  const resposta = await postar(criarHandler({ serviceClient }), PAYLOAD_DIRECT);
  assertEquals(await resposta.json(), { ok: true, gravados: 0, duplicados: 1, ignorados: 0 });
});

Deno.test("rate limit estourado responde 429 depois da assinatura válida", async () => {
  const { serviceClient } = clienteFake({ rateLimitPermitido: false });
  const resposta = await postar(criarHandler({ serviceClient }), PAYLOAD_DIRECT);
  assertEquals(resposta.status, 429);
});

Deno.test("GET de verificação devolve o challenge só com o verify token DAQUELE canal", async () => {
  const { serviceClient } = clienteFake({});
  const url = `${BASE}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1234567890`;
  const ok = await criarHandler({ serviceClient })(new Request(url));
  assertEquals(ok.status, 200);
  assertEquals(await ok.text(), "1234567890");

  const errado = `${BASE}?hub.mode=subscribe&hub.verify_token=token-de-outro&hub.challenge=1234567890`;
  const recusado = await criarHandler({ serviceClient })(new Request(errado));
  assertEquals(recusado.status, 403);
  assertEquals((await recusado.json()).codigo, "challenge_recusado");
});

Deno.test("assinatura esperada muda com o segredo — o HMAC é sobre os bytes crus", async () => {
  const bytes = new TextEncoder().encode('{"a":1}');
  assertNotEquals(await assinaturaEsperada("um", bytes), await assinaturaEsperada("outro", bytes));
  assertEquals(
    (await assinaturaEsperada(APP_SECRET, bytes)).startsWith("sha256="),
    true,
  );
});
