// Gateway restrito à rede sintética; barreira controla somente a resposta do download.
const origem: Record<string, string | undefined> = {
  "/auth/v1/": Deno.env.get("AUTH_ORIGIN"),
  "/rest/v1/": Deno.env.get("REST_ORIGIN"),
  "/storage/v1/": Deno.env.get("STORAGE_ORIGIN"),
};
const chave = Deno.env.get("BARRIER_SECRET") ?? "";
let armado = false;
let aguardando = false;
let liberar: (() => void) | undefined;
Deno.serve({ port: 9000 }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/__barreira/")) {
    if (chave.length < 48 || req.headers.get("x-barreira") !== chave || req.method !== "POST") return new Response(null, { status: 404 });
    if (url.pathname === "/__barreira/armar" && !armado && !aguardando) { armado = true; return new Response(null, { status: 204 }); }
    if (url.pathname === "/__barreira/status") return new Response(null, { status: aguardando ? 204 : 409 });
    if (url.pathname === "/__barreira/liberar" && aguardando && liberar) { liberar(); return new Response(null, { status: 204 }); }
    return new Response(null, { status: 409 });
  }
  const prefixo = Object.keys(origem).find((item) => url.pathname.startsWith(item));
  if (!prefixo) return new Response(null, { status: 404 });
  const destino = origem[prefixo];
  if (!destino || !/^http:\/\/sso-recorte-[0-9a-f]{12}-(auth|rest|storage):[0-9]+$/.test(destino)) return new Response(null, { status: 503 });
  try {
    const resposta = await fetch(new Request(new URL(url.pathname.slice(prefixo.length) + url.search, `${destino}/`), req), { redirect: "error", signal: AbortSignal.timeout(30000) });
    if (armado && prefixo === "/storage/v1/" && ["/storage/v1/object/authenticated/sso-levantamento-documentos/", "/storage/v1/object/authenticated/sso-levantamento-fotos/"].some((p) => url.pathname.startsWith(p)) && req.method === "GET" && resposta.ok) {
      armado = false; aguardando = true;
      try { await Promise.race([new Promise<void>((resolve) => { liberar = resolve; }), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("barreira expirada")), 15000))]); }
      finally { aguardando = false; liberar = undefined; }
    }
    return resposta;
  } catch { return new Response(null, { status: 503 }); }
});
