import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarHandler } from "./index.ts";

const CANAL_ID = "11111111-1111-1111-1111-111111111111";
const SEGREDO = "segredo-correto-do-canal";

interface Config {
  canal?: { id: string; identificador_externo: string | null; ativo: boolean } | null;
  webhookSecretRef?: string | null;
  segredoLido?: string | null;
  rateLimitPermitido?: boolean;
  registrarResultado?: { data: unknown; error: unknown };
  celularErro?: unknown;
}

function serviceClientFake(cfg: Config) {
  const chamadas: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const serviceClient = {
    schema(_s: string) {
      return {
        from(tabela: string) {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => {
              if (tabela === "canais_externos") {
                return { data: cfg.canal === undefined ? { id: CANAL_ID, identificador_externo: "inst-1", ativo: true } : cfg.canal, error: null };
              }
              if (tabela === "evolution_instancia") {
                return {
                  data:
                    cfg.webhookSecretRef === undefined
                      ? { webhook_secret_ref: "SINERGICA_EVOWEBHOOK_1_ref" }
                      : cfg.webhookSecretRef === null
                        ? null
                        : { webhook_secret_ref: cfg.webhookSecretRef },
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          };
        },
        rpc: async (fn: string, args: Record<string, unknown>) => {
          chamadas.push({ fn, args });
          if (fn === "fn_ler_segredo_referenciado") {
            return { data: cfg.segredoLido === undefined ? SEGREDO : cfg.segredoLido, error: null };
          }
          if (fn === "fn_consumir_rate_limit_webhook") {
            return { data: cfg.rateLimitPermitido ?? true, error: null };
          }
          if (fn === "fn_registrar_mensagem_celular") {
            return { error: cfg.celularErro ?? null };
          }
          if (fn === "fn_registrar_mensagem_evolution") {
            return cfg.registrarResultado ?? { data: [{ mensagem_id: "msg-1", conversa_id: "conv-1", duplicado: false }], error: null };
          }
          return { data: null, error: null };
        },
      };
    },
  };
  // deno-lint-ignore no-explicit-any
  return { serviceClient: serviceClient as any, chamadas };
}

function req(
  opts: {
    method?: string;
    canalId?: string | null;
    header?: string | null;
    body?: unknown;
    contentType?: string | null;
    rawBody?: string;
  } = {},
): Request {
  const url = `https://x.local/functions/v1/atendimento-evolution-webhook/${opts.canalId === undefined ? CANAL_ID : opts.canalId ?? ""}`;
  const headers = new Headers();
  if (opts.contentType !== null) headers.set("content-type", opts.contentType ?? "application/json");
  if (opts.header !== undefined) {
    if (opts.header !== null) headers.set("x-sinergica-evolution-webhook", opts.header);
  } else {
    headers.set("x-sinergica-evolution-webhook", SEGREDO);
  }
  return new Request(url, {
    method: opts.method ?? "POST",
    headers,
    body: opts.rawBody ?? JSON.stringify(opts.body ?? payloadTexto()),
  });
}

function payloadTexto(remoteId = "MSG1") {
  return {
    event: "MESSAGES_UPSERT",
    data: {
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: remoteId, fromMe: false },
      message: { conversation: "oi" },
    },
  };
}

Deno.test("método diferente de POST -> 405", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(
    new Request(`https://x.local/functions/v1/atendimento-evolution-webhook/${CANAL_ID}`, {
      method: "GET",
    }),
  );
  assertEquals(resposta.status, 405);
});

Deno.test("canal ausente -> 404", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req({ canalId: null }));
  assertEquals(resposta.status, 404);
});

Deno.test("canal inexistente no banco -> 404", async () => {
  const { serviceClient } = serviceClientFake({ canal: null });
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req());
  assertEquals(resposta.status, 404);
});

Deno.test("segredo ausente -> 401 (e nunca 400): corpo inválido não é alcançado", async () => {
  // Se o handler lesse o corpo ANTES de autenticar, um JSON quebrado venceria a corrida e daria
  // 400 — a autenticação tem que vencer sempre, mesmo com corpo ilegível (plan.md §3).
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req({ header: null, rawBody: "{ isso nao é json" }));
  assertEquals(resposta.status, 401);
});

Deno.test("segredo errado -> 401", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req({ header: "segredo-errado" }));
  assertEquals(resposta.status, 401);
});

Deno.test("canal sem instância/segredo configurado -> 401", async () => {
  const { serviceClient } = serviceClientFake({ webhookSecretRef: null });
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req());
  assertEquals(resposta.status, 401);
});

Deno.test("rate limit excedido -> 429", async () => {
  const { serviceClient } = serviceClientFake({ rateLimitPermitido: false });
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req());
  assertEquals(resposta.status, 429);
});

Deno.test("content-type não é JSON -> 415", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req({ contentType: "text/plain" }));
  assertEquals(resposta.status, 415);
});

Deno.test("corpo acima de 256KB -> 413", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const corpoGigante = JSON.stringify({ x: "a".repeat(300 * 1024) });
  const resposta = await handler(req({ rawBody: corpoGigante }));
  assertEquals(resposta.status, 413);
});

Deno.test("JSON inválido -> 400", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req({ rawBody: "{ isso nao é json" }));
  assertEquals(resposta.status, 400);
});

Deno.test("instância divergente no corpo -> 409", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(
    req({ body: { ...payloadTexto(), instance: "outra-instancia-diferente" } }),
  );
  assertEquals(resposta.status, 409);
});

Deno.test("evento ignorável -> 200 { ignorado: true }", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req({ body: { event: "CONNECTION_UPDATE" } }));
  assertEquals(resposta.status, 200);
  const corpo = await resposta.json();
  assertEquals(corpo.ignorado, true);
});

Deno.test("mídia reconhecida mas não persistida nesta story -> 200 ignorado", async () => {
  const { serviceClient } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(
    req({
      body: {
        event: "MESSAGES_UPSERT",
        data: {
          key: { remoteJid: "5511999999999@s.whatsapp.net", id: "M1", fromMe: false },
          message: { imageMessage: { caption: "foto" } },
        },
      },
    }),
  );
  assertEquals(resposta.status, 200);
  const corpo = await resposta.json();
  assertEquals(corpo.ignorado, true);
  assertEquals(corpo.tipo, "midia");
});

Deno.test("mensagem do aparelho (fromMe) vai para fn_registrar_mensagem_do_aparelho (E02-S39)", async () => {
  const { serviceClient, chamadas } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(
    req({
      body: {
        event: "MESSAGES_UPSERT",
        data: {
          key: { remoteJid: "5511999999999@s.whatsapp.net", id: "M2", fromMe: true },
          message: { conversation: "respondi pelo celular" },
        },
      },
    }),
  );
  assertEquals(resposta.status, 200);
  const chamada = chamadas.find((c) => c.fn === "fn_registrar_mensagem_do_aparelho");
  assertEquals(chamada?.args.p_texto, "respondi pelo celular");
  assertEquals(
    chamadas.some((c) => c.fn === "fn_registrar_mensagem_evolution"),
    false,
  );
});

Deno.test("texto elegível registra via fn_registrar_mensagem_evolution", async () => {
  const { serviceClient, chamadas } = serviceClientFake({});
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req({ body: payloadTexto("MSG_NOVA") }));
  assertEquals(resposta.status, 200);
  const chamada = chamadas.find((c) => c.fn === "fn_registrar_mensagem_evolution");
  assertEquals(chamada?.args.p_remote_id, "MSG_NOVA");
  assertEquals(chamada?.args.p_canal_id, CANAL_ID);
});

Deno.test("duplicado responde 200 { duplicado: true }", async () => {
  const { serviceClient } = serviceClientFake({
    registrarResultado: { data: [{ mensagem_id: null, conversa_id: null, duplicado: true }], error: null },
  });
  const handler = criarHandler({ serviceClient });
  const resposta = await handler(req());
  assertEquals(resposta.status, 200);
  const corpo = await resposta.json();
  assertEquals(corpo.duplicado, true);
});

Deno.test("E02-S40 — mensagem nova dispara busca de foto, duplicado não dispara", async () => {
  const chamadasDeFoto: unknown[] = [];
  const atualizarFoto = async (entrada: unknown) => {
    chamadasDeFoto.push(entrada);
  };

  const { serviceClient: scNova } = serviceClientFake({});
  await criarHandler({ serviceClient: scNova, atualizarFoto })(req({ body: payloadTexto("MSG_FOTO1") }));
  assertEquals(chamadasDeFoto.length, 1);
  assertEquals((chamadasDeFoto[0] as { conversaId: string }).conversaId, "conv-1");

  const { serviceClient: scDup } = serviceClientFake({
    registrarResultado: { data: [{ mensagem_id: null, conversa_id: null, duplicado: true }], error: null },
  });
  await criarHandler({ serviceClient: scDup, atualizarFoto })(req({ body: payloadTexto("MSG_FOTO2") }));
  assertEquals(chamadasDeFoto.length, 1); // não cresceu — duplicado não dispara busca
});

Deno.test("E02-S40 — falha na busca de foto nunca derruba a resposta do webhook", async () => {
  const atualizarFoto = async () => {
    throw new Error("Evolution fora do ar");
  };
  const { serviceClient } = serviceClientFake({});
  const resposta = await criarHandler({ serviceClient, atualizarFoto })(
    req({ body: payloadTexto("MSG_FOTO3") }),
  );
  assertEquals(resposta.status, 200);
});
