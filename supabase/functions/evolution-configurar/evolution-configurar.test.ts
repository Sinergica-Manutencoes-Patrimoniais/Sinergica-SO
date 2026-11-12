import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { HttpError } from "../_shared/auth.ts";
import { criarHandler } from "./index.ts";

interface RespostaSimulada {
  schema: string;
  table: string;
  resultado: { data: unknown; error: unknown };
}

function clientFake(opts: {
  perfil?: { papel: string; ativo: boolean } | null;
  rpcErro?: unknown;
  insertErro?: unknown;
}) {
  const perfil = opts.perfil ?? { papel: "superadmin", ativo: true };

  const userClient = {
    schema(_schemaName: string) {
      return {
        from(_tableName: string) {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: perfil, error: null }),
          };
        },
      };
    },
  };

  const serviceClient = {
    rpc: async (_fn: string, _args: Record<string, unknown>) => ({
      error: opts.rpcErro ?? null,
    }),
    schema(_schemaName: string) {
      return {
        from(_tableName: string) {
          return {
            insert: async (_valores: Record<string, unknown>) => ({
              error: opts.insertErro ?? null,
            }),
          };
        },
      };
    },
  };

  // deno-lint-ignore no-explicit-any
  return { userClient: userClient as any, serviceClient: serviceClient as any };
}

function fetchFake(status: number, corpo: unknown) {
  return async (): Promise<Response> =>
    new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

Deno.test("salvar_servidor — recusa colaborador (não-superadmin)", async () => {
  const { userClient, serviceClient } = clientFake({ perfil: { papel: "colaborador", ativo: true } });
  const handler = criarHandler({
    userClient,
    serviceClient,
    fetchEvolution: fetchFake(200, { version: "2.1.1" }),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  await assertRejects(
    () =>
      handler(
        { acao: "salvar_servidor", urlBase: "https://evolution.exemplo.com.br", apikeyGlobal: "chave" },
        "user-1",
      ),
    HttpError,
  );
});

Deno.test("salvar_servidor — recusa URL com IP privado (SSRF)", async () => {
  const { userClient, serviceClient } = clientFake({});
  const handler = criarHandler({
    userClient,
    serviceClient,
    fetchEvolution: fetchFake(200, { version: "2.1.1" }),
    resolverDns: async () => ["10.0.0.5"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () =>
      handler(
        { acao: "salvar_servidor", urlBase: "https://interno.exemplo.com.br", apikeyGlobal: "chave" },
        "user-1",
      ),
    HttpError,
  );
  assertEquals((erro as HttpError).message.startsWith("url_recusada:"), true);
});

Deno.test("salvar_servidor — versão fora da matriz marca incompatível, sem bloquear", async () => {
  const { userClient, serviceClient } = clientFake({});
  const handler = criarHandler({
    userClient,
    serviceClient,
    fetchEvolution: fetchFake(200, { version: "9.9.9" }),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const resultado = await handler(
    { acao: "salvar_servidor", urlBase: "https://evolution.exemplo.com.br", apikeyGlobal: "chave" },
    "user-1",
  );
  assertEquals(resultado.estado, "incompativel");
  assertEquals(typeof resultado.motivo, "string");
});

Deno.test("salvar_servidor — versão compatível e matriz completa", async () => {
  const { userClient, serviceClient } = clientFake({});
  const handler = criarHandler({
    userClient,
    serviceClient,
    fetchEvolution: fetchFake(200, { version: "2.1.1" }),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const resultado = await handler(
    { acao: "salvar_servidor", urlBase: "https://evolution.exemplo.com.br", apikeyGlobal: "chave" },
    "user-1",
  );
  assertEquals(resultado.estado, "compativel");
  assertEquals(resultado.versao, "2.1.1");
  assertEquals("apikeyGlobal" in resultado, false);
  assertEquals(JSON.stringify(resultado).includes("chave"), false);
});

Deno.test("salvar_servidor — falha do cofre vira 502, não expõe detalhe", async () => {
  const { userClient, serviceClient } = clientFake({ rpcErro: { message: "vault indisponível" } });
  const handler = criarHandler({
    userClient,
    serviceClient,
    fetchEvolution: fetchFake(200, { version: "2.1.1" }),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () =>
      handler(
        { acao: "salvar_servidor", urlBase: "https://evolution.exemplo.com.br", apikeyGlobal: "chave" },
        "user-1",
      ),
    HttpError,
  );
  assertEquals((erro as HttpError).message, "cofre_indisponivel");
});

Deno.test("salvar_servidor — servidor indisponível (probe falha)", async () => {
  const { userClient, serviceClient } = clientFake({});
  const handler = criarHandler({
    userClient,
    serviceClient,
    fetchEvolution: fetchFake(503, {}),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () =>
      handler(
        { acao: "salvar_servidor", urlBase: "https://evolution.exemplo.com.br", apikeyGlobal: "chave" },
        "user-1",
      ),
    HttpError,
  );
  assertEquals((erro as HttpError).message, "servidor_indisponivel");
});

Deno.test("criar_instancia / instalar_webhook — ainda não implementadas, falham explícito (501)", async () => {
  const { userClient, serviceClient } = clientFake({});
  const handler = criarHandler({
    userClient,
    serviceClient,
    fetchEvolution: fetchFake(200, {}),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  await assertRejects(
    () => handler({ acao: "criar_instancia", canalId: crypto.randomUUID() }, "user-1"),
    HttpError,
  );
});
