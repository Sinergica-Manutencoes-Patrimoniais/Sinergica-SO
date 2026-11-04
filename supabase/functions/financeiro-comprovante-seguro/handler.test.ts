import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const id = "18410000-0000-4000-8000-000000000012";

Deno.test("Storage que não envia cabeçalhos no prazo falha fechado", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  const servidor = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return new Response("segredo");
  });
  try {
    const baixar = mod.criarTransporteStorage(`http://127.0.0.1:${(servidor.addr as Deno.NetAddr).port}`, "chave-sintetica", 40);
    const resposta = await mod.criarHandler({ autenticar: async () => "usuario", limitar: async () => true,
      resolver: async () => "cliente/lento.pdf", baixar, cors: () => ({})
    })(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) }));
    assertEquals(resposta.status, 503);
    assertEquals((await resposta.text()).includes("segredo"), false);
  } finally { await servidor.shutdown(); }
});

Deno.test("download lento é interrompido mesmo após receber cabeçalhos", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  const criar = mod.criarTransporteStorage as (url: string, chave: string, prazoMs: number) => (caminho: string) => Promise<Response>;
  const servidor = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, () => new Response(new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(new TextEncoder().encode("parcial")); setTimeout(() => { try { c.close(); } catch { /* conexão cancelada */ } }, 250); },
  })));
  try {
    const baixar = criar(`http://127.0.0.1:${(servidor.addr as Deno.NetAddr).port}`, "chave-sintetica", 40);
    const resposta = await mod.criarHandler({ autenticar: async () => "usuario", limitar: async () => true,
      resolver: async () => "cliente/lento.pdf", baixar, cors: () => ({})
    })(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) }));
    assertEquals(resposta.status, 503);
    assertEquals((await resposta.text()).includes("parcial"), false);
  } finally { await servidor.shutdown(); }
});

Deno.test("transporte envia credencial sintética somente ao Storage configurado e recusa redireção", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  const criar = (mod as unknown as { criarTransporteStorage?: (url: string, chave: string) => (caminho: string) => Promise<Response> }).criarTransporteStorage;
  assertEquals(typeof criar, "function");
  if (!criar) return;
  let redirecoes = 0;
  const destino = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, () => { redirecoes++; return new Response("não permitido"); });
  const destinoUrl = `http://127.0.0.1:${(destino.addr as Deno.NetAddr).port}`;
  let caminhoRecebido = "";
  let autorizacao = "";
  let requisicoes = 0;
  const storage = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, (req) => {
    requisicoes++;
    caminhoRecebido = new URL(req.url).pathname;
    autorizacao = req.headers.get("authorization") ?? "";
    if (caminhoRecebido.endsWith("/grande")) {
      return new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(6 * 1024 * 1024)); c.enqueue(new Uint8Array(5 * 1024 * 1024)); c.close(); } }));
    }
    return caminhoRecebido.endsWith("/redireciona") ? Response.redirect(destinoUrl, 302) : new Response("sintético");
  });
  try {
    const baixar = criar(`http://127.0.0.1:${(storage.addr as Deno.NetAddr).port}`, "chave-sintetica");
    assertEquals(await (await baixar("cliente/nota #1.pdf")).text(), "sintético");
    assertEquals(caminhoRecebido, "/storage/v1/object/authenticated/financeiro-comprovantes/cliente/nota%20%231.pdf");
    assertEquals(autorizacao, "Bearer chave-sintetica");
    let consultas = 0;
    const resposta = await mod.criarHandler({
      autenticar: async () => "usuario", limitar: async () => true,
      resolver: async () => { consultas++; return "cliente/nota #1.pdf"; },
      baixar, cors: () => ({}),
    })(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) }));
    assertEquals(resposta.status, 200);
    assertEquals(await resposta.text(), "sintético");
    assertEquals(consultas, 2);
    const grande = await mod.criarHandler({
      autenticar: async () => "usuario", limitar: async () => true,
      resolver: async () => "cliente/grande", baixar, cors: () => ({}),
    })(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) }));
    assertEquals(grande.status, 413);
    let recusou = false;
    try { await baixar("cliente/redireciona"); } catch { recusou = true; }
    assertEquals(recusou, true);
    assertEquals(redirecoes, 0);
    for (const caminho of ["../outro", "cliente//arquivo", "/arquivo", "cliente\\arquivo"]) {
      let invalido = false;
      try { await baixar(caminho); } catch { invalido = true; }
      assertEquals(invalido, true);
    }
    assertEquals(requisicoes, 4);
  } finally { await storage.shutdown(); await destino.shutdown(); }
});

Deno.test("download fragmentado acima de 10 MiB é cancelado antes de entregar dados", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  let cancelado = false;
  const fluxo = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(6 * 1024 * 1024));
      controller.enqueue(new Uint8Array(5 * 1024 * 1024));
    },
    cancel() { cancelado = true; },
  });
  const resposta = await mod.criarHandler({
    autenticar: async () => "usuario", limitar: async () => true,
    resolver: async () => "privado/nota.pdf",
    baixar: async () => new Response(fluxo, { headers: { "content-length": "1" } }),
    cors: () => ({}),
  })(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) }));
  assertEquals(resposta.status, 413);
  assertEquals(cancelado, true);
});

Deno.test("download em fluxo aceita exatamente 10 MiB e revalida antes de entregar", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  let consultas = 0;
  const handler = mod.criarHandler({
    autenticar: async () => "usuario", limitar: async () => true,
    resolver: async () => { consultas++; return "privado/nota.pdf"; },
    baixar: async () => new Response(new Uint8Array(10 * 1024 * 1024)),
    cors: () => ({}),
  });
  const resposta = await handler(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) }));
  assertEquals(resposta.status, 200);
  assertEquals((await resposta.arrayBuffer()).byteLength, 10 * 1024 * 1024);
  assertEquals(consultas, 2);
});

Deno.test("download em fluxo não entrega bytes após revogação", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  let consultas = 0;
  const resposta = await mod.criarHandler({
    autenticar: async () => "usuario", limitar: async () => true,
    resolver: async () => ++consultas === 1 ? "privado/nota.pdf" : null,
    baixar: async () => new Response("segredo"), cors: () => ({}),
  })(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) }));
  assertEquals(resposta.status, 404);
  assertEquals((await resposta.text()).includes("segredo"), false);
});

Deno.test("rota limita corpo grande mesmo com comprimento informado incorreto", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  let consultas = 0;
  const handler = mod.criarHandler({
    autenticar: async () => "usuario",
    limitar: async () => true,
    resolver: async () => {
      consultas++;
      return "privado";
    },
    baixar: async () => new Blob(["segredo"]),
    cors: () => ({}),
  });
  const corpo = JSON.stringify({ lancamentoId: id }) + " ".repeat(5_000);
  const resposta = await handler(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-length": "2" },
      body: corpo,
    }),
  );
  assertEquals(resposta.status, 413);
  assertEquals(consultas, 0);
});

Deno.test("limite do corpo considera bytes e aceita o tamanho exato", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  const handler = mod.criarHandler({
    autenticar: async () => "usuario",
    limitar: async () => true,
    resolver: async () => "privado",
    baixar: async () => new Blob(["ok"]),
    cors: () => ({}),
  });
  const entrada = JSON.stringify({ lancamentoId: id });
  const corpo = entrada + " ".repeat(4096 - entrada.length);
  const resposta = await handler(
    new Request("http://localhost/", { method: "POST", body: corpo }),
  );
  assertEquals(resposta.status, 200);
  const maior = entrada + " ".repeat(4096 - entrada.length - 1) + "é";
  assertEquals(maior.length, 4096);
  const recusada = await handler(
    new Request("http://localhost/", { method: "POST", body: maior }),
  );
  assertEquals(recusada.status, 413);
});

Deno.test("corpo em partes é interrompido ao ultrapassar o limite", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  let cancelado = false;
  const corpo = new ReadableStream<Uint8Array>({
    start(controlador) {
      controlador.enqueue(new Uint8Array(3000));
      controlador.enqueue(new Uint8Array(2000));
    },
    cancel() {
      cancelado = true;
    },
  });
  const resposta = await mod.criarHandler({
    autenticar: async () => "usuario",
    limitar: async () => true,
    resolver: async () => {
      throw new Error("não deve consultar");
    },
    baixar: async () => new Blob(["segredo"]),
    cors: () => ({}),
  })(new Request("http://localhost/", { method: "POST", body: corpo }));
  assertEquals(resposta.status, 413);
  assertEquals(cancelado, true);
});
const carregar = async () => {
  try {
    return await import("./handler.ts");
  } catch (e) {
    if (e instanceof TypeError && String(e).includes("Module not found")) {
      return null;
    }
    throw e;
  }
};
Deno.test("rota entrega apenas conteúdo autorizado sem caminho ou URL", async () => {
  const mod = await carregar();
  assertEquals(typeof mod?.criarHandler, "function");
  if (!mod) return;
  const resposta = await mod.criarHandler({
    autenticar: async () => "usuario",
    limitar: async () => true,
    resolver: async () => "privado/nota.pdf",
    baixar: async () =>
      new Blob(["conteúdo privado"], { type: "application/pdf" }),
    cors: () => ({}),
  })(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lancamentoId: id }),
    }),
  );
  assertEquals(resposta.status, 200);
  assertEquals(await resposta.text(), "conteúdo privado");
  assertEquals(resposta.headers.get("cache-control"), "private, no-store");
  assertEquals(
    resposta.headers.get("content-disposition"),
    'attachment; filename="comprovante"',
  );
  assertEquals(
    resposta.headers.get("content-type"),
    "application/octet-stream",
  );
});
Deno.test("revogação durante download impede entregar bytes", async () => {
  const mod = await carregar();
  assertEquals(typeof mod?.criarHandler, "function");
  if (!mod) return;
  let chamadas = 0;
  const resposta = await mod.criarHandler({
    autenticar: async () => "usuario",
    limitar: async () => true,
    resolver: async () => ++chamadas === 1 ? "privado/nota.pdf" : null,
    baixar: async () => new Blob(["segredo"]),
    cors: () => ({}),
  })(
    new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ lancamentoId: id }),
    }),
  );
  assertEquals(resposta.status, 404);
  assertEquals((await resposta.text()).includes("segredo"), false);
});
Deno.test("rota recusa entrada com caminho e aplica limite antes de consultar arquivo", async () => {
  const mod = await carregar();
  assertEquals(typeof mod?.criarHandler, "function");
  if (!mod) return;
  let consultas = 0;
  const deps = {
    autenticar: async () => "usuario",
    limitar: async () => true,
    resolver: async () => {
      consultas++;
      return "privado/nota.pdf";
    },
    baixar: async () => new Blob(["segredo"]),
    cors: () => ({}),
  };
  const handler = mod.criarHandler(deps);
  const invalida = await handler(
    new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ lancamentoId: id, path: "outro" }),
    }),
  );
  assertEquals(invalida.status, 422);
  const limitada = await mod.criarHandler({
    ...deps,
    limitar: async () => false,
  })(
    new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ lancamentoId: id }),
    }),
  );
  assertEquals(limitada.status, 429);
  assertEquals(consultas, 0);
});
Deno.test("rota bloqueia usuário sem autenticação antes de consultar ou baixar", async () => {
  const mod = await carregar();
  assertEquals(typeof mod?.criarHandler, "function");
  if (!mod) return;
  let chamadas = 0;
  const resposta = await mod.criarHandler({
    autenticar: async () => {
      throw new Error("token privado");
    },
    limitar: async () => {
      chamadas++;
      return true;
    },
    resolver: async () => {
      chamadas++;
      return "privado";
    },
    baixar: async () => {
      chamadas++;
      return new Blob(["segredo"]);
    },
    cors: () => ({}),
  })(
    new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ lancamentoId: id }),
    }),
  );
  assertEquals(resposta.status, 401);
  assertEquals(chamadas, 0);
  assertEquals((await resposta.text()).includes("token privado"), false);
});
Deno.test("mudança de vínculo ou falha do Storage não expõe dados", async () => {
  const mod = await carregar();
  assertEquals(typeof mod?.criarHandler, "function");
  if (!mod) return;
  let vezes = 0;
  const base = {
    autenticar: async () => "usuario",
    limitar: async () => true,
    resolver: async () =>
      ++vezes === 1 ? "privado/antigo.pdf" : "privado/novo.pdf",
    baixar: async () => new Blob(["segredo"]),
    cors: () => ({}),
  };
  const req = () =>
    new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ lancamentoId: id }),
    });
  const divergente = await mod.criarHandler(base)(req());
  assertEquals(divergente.status, 404);
  assertEquals((await divergente.text()).includes("segredo"), false);
  const indisponivel = await mod.criarHandler({
    ...base,
    resolver: async () => "privado/nota.pdf",
    baixar: async () => {
      throw new Error("privado/nota.pdf");
    },
  })(req());
  assertEquals(indisponivel.status, 503);
  assertEquals((await indisponivel.text()).includes("privado/nota.pdf"), false);
});

Deno.test("acesso negado ou auditoria recusada não entrega bytes nem caminho", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  const caminho = "cliente-confidencial/comprovante.pdf";
  let downloads = 0;
  const deps = {
    autenticar: async () => "usuario",
    limitar: async () => true,
    resolver: async () => null as string | null,
    baixar: async () => { downloads++; return new Blob(["bytes-privados"]); },
    cors: () => ({}),
  };
  const req = () => new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) });
  const negada = await mod.criarHandler(deps)(req());
  assertEquals(negada.status, 404);
  assertEquals(downloads, 0);
  const auditada = await mod.criarHandler({ ...deps, resolver: async () => caminho, auditar: async () => false })(req());
  assertEquals(auditada.status, 404);
  const corpo = await auditada.text();
  assertEquals(corpo.includes(caminho), false);
  assertEquals(corpo.includes("bytes-privados"), false);
  assertEquals([...auditada.headers.values()].some(valor => valor.includes(caminho)), false);
});

Deno.test("erro do armazenamento não revela caminho em resposta ou log", async () => {
  const mod = await carregar();
  if (!mod) throw new Error("Handler indisponível");
  const caminho = "cliente-confidencial/comprovante.pdf";
  const logs: string[] = [];
  const anterior = console.error;
  try {
    console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
    const resposta = await mod.criarHandler({
      autenticar: async () => "usuario",
      limitar: async () => true,
      resolver: async () => caminho,
      baixar: async () => { throw new Error(`Storage indisponível: ${caminho}`); },
      cors: () => ({}),
    })(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: id }) }));
    assertEquals(resposta.status, 503);
    assertEquals((await resposta.text()).includes(caminho), false);
    assertEquals(logs.some(item => item.includes(caminho)), false);
    assertEquals(logs.length, 1);
  } finally { console.error = anterior; }
});
