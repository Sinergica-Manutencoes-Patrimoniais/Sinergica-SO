import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { HttpError } from "../_shared/auth.ts";
import { criarHandler } from "./index.ts";

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
        rpc: async (_fn: string, _args: Record<string, unknown>) => ({
          error: opts.rpcErro ?? null,
        }),
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

interface RespostaTabela {
  maybeSingle?: { data: unknown; error: unknown };
  insert?: { error: unknown };
  update?: { error: unknown };
}

/** Fake com várias tabelas e RPCs — para os fluxos de criar_instancia/instalar_webhook, que
 * tocam canais_externos, evolution_servidor e evolution_instancia em sequência. */
function serviceClientTabelas(
  tabelas: Record<string, RespostaTabela>,
  rpc: Record<string, { data?: unknown; error?: unknown }> = {},
) {
  const chamadasRpc: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const atualizacoes: Array<{ tabela: string; valores: Record<string, unknown> }> = [];
  const insercoes: Array<{ tabela: string; valores: Record<string, unknown> }> = [];
  const serviceClient = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      chamadasRpc.push({ fn, args });
      return rpc[fn] ?? { data: null, error: null };
    },
    schema(_schemaName: string) {
      return {
        from(tableName: string) {
          const cfg = tabelas[tableName] ?? {};
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              return this;
            },
            maybeSingle: async () => cfg.maybeSingle ?? { data: null, error: null },
            insert: async (valores: Record<string, unknown>) => {
              insercoes.push({ tabela: tableName, valores });
              return cfg.insert ?? { error: null };
            },
            update(valores: Record<string, unknown>) {
              atualizacoes.push({ tabela: tableName, valores });
              return { eq: async () => cfg.update ?? { error: null } };
            },
          };
        },
        rpc: async (fn: string, args: Record<string, unknown>) => {
          chamadasRpc.push({ fn, args });
          return rpc[fn] ?? { data: null, error: null };
        },
      };
    },
  };
  // deno-lint-ignore no-explicit-any
  return { serviceClient: serviceClient as any, chamadasRpc, atualizacoes, insercoes };
}

const userClientSuperadmin = {
  schema(_s: string) {
    return {
      from(_t: string) {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: { papel: "superadmin", ativo: true }, error: null }),
        };
      },
    };
    // deno-lint-ignore no-explicit-any
  },
} as any;

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

// ───────── criar_instancia ─────────

const SERVIDOR_COMPATIVEL = {
  maybeSingle: {
    data: { url_base: "https://evolution.exemplo.com.br", credencial_ref: "SINERGICA_EVOSERVIDOR_1_ref" },
    error: null,
  },
};

Deno.test("criar_instancia — idempotente: instância já existe, não recria", async () => {
  const { serviceClient, chamadasRpc } = serviceClientTabelas({
    evolution_instancia: { maybeSingle: { data: { estado: "aguardando_pareamento" }, error: null } },
  });
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(200, {}),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const resultado = await handler({ acao: "criar_instancia", canalId: crypto.randomUUID() }, "user-1");
  assertEquals(resultado, { estado: "aguardando_pareamento", jaExistia: true });
  assertEquals(chamadasRpc.length, 0); // não tocou o cofre de novo
});

Deno.test("criar_instancia — canal inexistente", async () => {
  const { serviceClient } = serviceClientTabelas({
    evolution_instancia: { maybeSingle: { data: null, error: null } },
    canais_externos: { maybeSingle: { data: null, error: null } },
  });
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(200, {}),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () => handler({ acao: "criar_instancia", canalId: crypto.randomUUID() }, "user-1"),
    HttpError,
  );
  assertEquals((erro as HttpError).message, "canal_nao_encontrado");
});

Deno.test("criar_instancia — sem servidor compatível", async () => {
  const { serviceClient } = serviceClientTabelas({
    evolution_instancia: { maybeSingle: { data: null, error: null } },
    canais_externos: { maybeSingle: { data: { id: "canal-1" }, error: null } },
    evolution_servidor: { maybeSingle: { data: null, error: null } },
  });
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(200, {}),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () => handler({ acao: "criar_instancia", canalId: crypto.randomUUID() }, "user-1"),
    HttpError,
  );
  assertEquals((erro as HttpError).message, "servidor_incompativel");
});

Deno.test("criar_instancia — Evolution fora do ar vira instancia_falhou", async () => {
  const { serviceClient } = serviceClientTabelas(
    {
      evolution_instancia: { maybeSingle: { data: null, error: null } },
      canais_externos: { maybeSingle: { data: { id: "canal-1" }, error: null } },
      evolution_servidor: SERVIDOR_COMPATIVEL,
    },
    { fn_ler_segredo_referenciado: { data: "apikey-global", error: null } },
  );
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(503, {}),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () => handler({ acao: "criar_instancia", canalId: crypto.randomUUID() }, "user-1"),
    HttpError,
  );
  assertEquals((erro as HttpError).message, "instancia_falhou");
});

Deno.test("criar_instancia — resposta sem token reconhecido falha fechado", async () => {
  const { serviceClient } = serviceClientTabelas(
    {
      evolution_instancia: { maybeSingle: { data: null, error: null } },
      canais_externos: { maybeSingle: { data: { id: "canal-1" }, error: null } },
      evolution_servidor: SERVIDOR_COMPATIVEL,
    },
    { fn_ler_segredo_referenciado: { data: "apikey-global", error: null } },
  );
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(200, { instance: { instanceName: "x" } }), // sem hash
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () => handler({ acao: "criar_instancia", canalId: crypto.randomUUID() }, "user-1"),
    HttpError,
  );
  assertEquals((erro as HttpError).message, "instancia_sem_token");
});

Deno.test("criar_instancia — caminho feliz: grava token no cofre, estado 'criando'", async () => {
  const { serviceClient, chamadasRpc } = serviceClientTabelas(
    {
      evolution_instancia: { maybeSingle: { data: null, error: null }, insert: { error: null } },
      canais_externos: { maybeSingle: { data: { id: "canal-1" }, error: null } },
      evolution_servidor: SERVIDOR_COMPATIVEL,
    },
    {
      fn_ler_segredo_referenciado: { data: "apikey-global", error: null },
      fn_gravar_segredo_referenciado: { error: null },
    },
  );
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(200, { hash: "token-da-instancia" }),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const resultado = await handler(
    { acao: "criar_instancia", canalId: crypto.randomUUID() },
    "user-1",
  );
  assertEquals(resultado, { estado: "criando", jaExistia: false });
  const gravou = chamadasRpc.find((c) => c.fn === "fn_gravar_segredo_referenciado");
  assertEquals(gravou?.args.p_valor, "token-da-instancia");
  // a resposta nunca inclui o token (AC-4: resposta crua é descartada)
  assertEquals(JSON.stringify(resultado).includes("token-da-instancia"), false);
});

Deno.test("criar_instancia — aceita hash como objeto { apikey }", async () => {
  const { serviceClient } = serviceClientTabelas(
    {
      evolution_instancia: { maybeSingle: { data: null, error: null }, insert: { error: null } },
      canais_externos: { maybeSingle: { data: { id: "canal-1" }, error: null } },
      evolution_servidor: SERVIDOR_COMPATIVEL,
    },
    {
      fn_ler_segredo_referenciado: { data: "apikey-global", error: null },
      fn_gravar_segredo_referenciado: { error: null },
    },
  );
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(200, { hash: { apikey: "token-objeto" } }),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const resultado = await handler(
    { acao: "criar_instancia", canalId: crypto.randomUUID() },
    "user-1",
  );
  assertEquals(resultado, { estado: "criando", jaExistia: false });
});

// ───────── instalar_webhook ─────────

Deno.test("instalar_webhook — instância inexistente", async () => {
  const { serviceClient } = serviceClientTabelas({
    evolution_instancia: { maybeSingle: { data: null, error: null } },
  });
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(200, {}),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () => handler({ acao: "instalar_webhook", canalId: crypto.randomUUID() }, "user-1"),
    HttpError,
  );
  assertEquals((erro as HttpError).message, "instancia_nao_encontrada");
});

Deno.test("instalar_webhook — falha remota deixa configuracao_incompleta, não conectado", async () => {
  const { serviceClient, atualizacoes } = serviceClientTabelas(
    {
      evolution_instancia: {
        maybeSingle: { data: { nome_remoto: "sinergica-canal-1", token_ref: "ref-token" }, error: null },
        update: { error: null },
      },
      evolution_servidor: SERVIDOR_COMPATIVEL,
    },
    {
      fn_ler_segredo_referenciado: { data: "token-da-instancia", error: null },
      fn_gravar_segredo_referenciado: { error: null },
    },
  );
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution: fetchFake(502, {}),
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const erro = await assertRejects(
    () => handler({ acao: "instalar_webhook", canalId: crypto.randomUUID() }, "user-1"),
    HttpError,
  );
  assertEquals((erro as HttpError).message, "webhook_falhou");
  const atualizacao = atualizacoes.find((a) => a.tabela === "evolution_instancia");
  assertEquals(atualizacao?.valores.estado, "configuracao_incompleta");
});

Deno.test("instalar_webhook — caminho feliz: segredo por canal, URL com canalId no caminho", async () => {
  const canalId = crypto.randomUUID();
  let corpoCapturado: unknown;
  let urlCapturada = "";
  const { serviceClient, atualizacoes } = serviceClientTabelas(
    {
      evolution_instancia: {
        maybeSingle: { data: { nome_remoto: "sinergica-canal-1", token_ref: "ref-token" }, error: null },
        update: { error: null },
      },
      evolution_servidor: SERVIDOR_COMPATIVEL,
    },
    {
      fn_ler_segredo_referenciado: { data: "token-da-instancia", error: null },
      fn_gravar_segredo_referenciado: { error: null },
    },
  );
  const fetchEvolution: typeof fetch = async (input, init) => {
    urlCapturada = String(input);
    corpoCapturado = JSON.parse(String(init?.body ?? "{}"));
    return new Response("{}", { status: 200 });
  };
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution,
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const resultado = await handler({ acao: "instalar_webhook", canalId }, "user-1");
  assertEquals(resultado, { estado: "aguardando_pareamento" });

  const webhook = (corpoCapturado as { webhook: Record<string, unknown> }).webhook;
  assertEquals(webhook.enabled, true);
  assertEquals(webhook.base64, false);
  assertEquals((webhook.url as string).endsWith(`/atendimento-evolution-webhook/${canalId}`), true);
  // segredo em cabeçalho customizado, nunca em query string (ADR-1686 §5)
  const headers = webhook.headers as Record<string, string>;
  assertEquals(typeof headers["x-sinergica-evolution-webhook"], "string");
  assertEquals(urlCapturada.includes("x-sinergica-evolution-webhook="), false);
  assertEquals(urlCapturada.includes("?"), false);

  const atualizacao = atualizacoes.find((a) => a.tabela === "evolution_instancia");
  assertEquals(atualizacao?.valores.estado, "aguardando_pareamento");
  assertEquals(typeof atualizacao?.valores.webhook_secret_ref, "string");
});

// ───────── criar_instancia — adoção de instância legada (E02-S35..S41, achado em produção) ─────────

Deno.test("criar_instancia — canal com identificador_externo adota sem chamar Evolution", async () => {
  const { serviceClient, insercoes } = serviceClientTabelas({
    evolution_instancia: { maybeSingle: { data: null, error: null }, insert: { error: null } },
    canais_externos: {
      maybeSingle: { data: { id: "canal-1", identificador_externo: "numero-ja-conectado" }, error: null },
    },
  });
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    // qualquer chamada de rede aqui seria um bug grave (criaria segunda instância/derrubaria sessão)
    fetchEvolution: (() => {
      throw new Error("não deveria chamar a Evolution ao adotar instância existente");
    }) as unknown as typeof fetch,
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const resultado = await handler(
    { acao: "criar_instancia", canalId: crypto.randomUUID() },
    "user-1",
  );
  assertEquals(resultado, { estado: "conectado_verificado", jaExistia: false, adotada: true });
  const insercao = insercoes.find((i) => i.tabela === "evolution_instancia");
  assertEquals(insercao?.valores.nome_remoto, "numero-ja-conectado");
  assertEquals(insercao?.valores.token_ref, null);
  assertEquals(insercao?.valores.estado, "conectado_verificado");
});

Deno.test("instalar_webhook — instância adotada usa apikey global e mantém conectado_verificado", async () => {
  const canalId = crypto.randomUUID();
  let apikeyUsada = "";
  const { serviceClient, atualizacoes } = serviceClientTabelas(
    {
      evolution_instancia: {
        maybeSingle: { data: { nome_remoto: "numero-ja-conectado", token_ref: null }, error: null },
        update: { error: null },
      },
      evolution_servidor: SERVIDOR_COMPATIVEL,
    },
    {
      fn_ler_segredo_referenciado: { data: "apikey-global", error: null },
      fn_gravar_segredo_referenciado: { error: null },
    },
  );
  const fetchEvolution: typeof fetch = async (_input, init) => {
    apikeyUsada = (init?.headers as Record<string, string>).apikey;
    return new Response("{}", { status: 200 });
  };
  const handler = criarHandler({
    userClient: userClientSuperadmin,
    serviceClient,
    fetchEvolution,
    resolverDns: async () => ["200.1.1.1"],
    permitirRedePrivada: false,
  });

  const resultado = await handler({ acao: "instalar_webhook", canalId }, "user-1");
  assertEquals(resultado, { estado: "conectado_verificado" });
  assertEquals(apikeyUsada, "apikey-global");

  const atualizacao = atualizacoes.find((a) => a.tabela === "evolution_instancia");
  assertEquals(atualizacao?.valores.estado, "conectado_verificado");
});
