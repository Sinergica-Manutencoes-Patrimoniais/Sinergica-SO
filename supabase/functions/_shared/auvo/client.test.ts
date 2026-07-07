// client.test.ts — teste unitário do cliente HTTP Auvo, focado em `auvoPatch`/`auvoDelete`
// (E01-S22 — motor de sync, write path) + comportamento de retry compartilhado por todos os
// métodos (401 renova token, 429 aplica backoff). Mocka `fetch` e `Deno.env`, sem rede real.
// Rodar localmente (requer Deno CLI, indisponível neste ambiente):
//   deno test supabase/functions/_shared/auvo/client.test.ts --allow-env

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { AuvoApiError, auvoDelete, auvoPatch } from "./client.ts";

/** Instala um `Deno.env.get` fake para as credenciais exigidas pelo login, e devolve uma função
 * de restauração — evita vazar mock entre testes. */
function withEnv(vars: Record<string, string>): () => void {
  const original = Deno.env.get;
  // deno-lint-ignore no-explicit-any
  (Deno.env as any).get = (key: string) => vars[key] ?? original.call(Deno.env, key);
  return () => {
    // deno-lint-ignore no-explicit-any
    (Deno.env as any).get = original;
  };
}

/** Instala um `fetch` fake que resolve `/login` sempre com sucesso (token novo a cada teste, para
 * não vazar o cache em memória de `client.ts` entre casos) e delega o resto para `handler`. */
function withFetch(handler: (req: Request, callIndex: number) => Response): () => void {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    calls++;
    if (req.url.includes("/login")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            result: {
              accessToken: `token-${crypto.randomUUID()}`,
              expiration: new Date(Date.now() + 30 * 60_000).toISOString(),
            },
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(handler(req, calls));
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const ENV = { AUVO_API_KEY: "fake-key", AUVO_USER_TOKEN: "fake-token" };

Deno.test("auvoPatch — envia método PATCH com corpo e devolve o JSON de resposta", async () => {
  const restoreEnv = withEnv(ENV);
  let seenMethod = "";
  let seenBody: unknown = null;
  const restoreFetch = withFetch((req) => {
    seenMethod = req.method;
    return new Response(JSON.stringify({ result: { id: 42 } }), { status: 200 });
  });
  try {
    const res = await auvoPatch<{ result: { id: number } }>("/products/42", { active: false });
    assertEquals(seenMethod, "PATCH");
    assertEquals(res.result.id, 42);
  } finally {
    restoreFetch();
    restoreEnv();
  }
  void seenBody;
});

Deno.test("auvoDelete — envia método DELETE sem corpo", async () => {
  const restoreEnv = withEnv(ENV);
  let seenMethod = "";
  let seenHasBody = true;
  const restoreFetch = withFetch((req) => {
    seenMethod = req.method;
    seenHasBody = req.body !== null;
    return new Response(null, { status: 204 });
  });
  try {
    const res = await auvoDelete<undefined>("/products/42");
    assertEquals(seenMethod, "DELETE");
    assertEquals(seenHasBody, false);
    assertEquals(res, undefined);
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

Deno.test("auvoPatch — 429 aplica 1 retry com backoff e depois sucede", async () => {
  const restoreEnv = withEnv(ENV);
  let attempts = 0;
  const restoreFetch = withFetch(() => {
    attempts++;
    if (attempts === 1) return new Response(null, { status: 429 });
    return new Response(JSON.stringify({ result: { id: 1 } }), { status: 200 });
  });
  try {
    const res = await auvoPatch<{ result: { id: number } }>("/products/1", { active: false });
    assertEquals(attempts, 2);
    assertEquals(res.result.id, 1);
  } finally {
    restoreFetch();
    restoreEnv();
  }
});

Deno.test("auvoPatch — falha após esgotar o retry lança AuvoApiError com o status original", async () => {
  const restoreEnv = withEnv(ENV);
  const restoreFetch = withFetch(() => new Response("erro", { status: 500 }));
  try {
    await assertRejects(
      () => auvoPatch("/products/1", { active: false }),
      AuvoApiError,
    );
  } finally {
    restoreFetch();
    restoreEnv();
  }
});
