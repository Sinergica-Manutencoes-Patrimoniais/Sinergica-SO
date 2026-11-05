// Gateway exclusivo do ensaio: somente serviços previamente nomeados na rede interna.
const rotas: Record<string, string> = {
  "/auth/v1/": "AUTH_ORIGIN",
  "/rest/v1/": "REST_ORIGIN",
  "/storage/v1/": "STORAGE_ORIGIN",
};
Deno.serve({ port: 9000 }, async (request) => {
  const caminho = new URL(request.url);
  const entrada = Object.entries(rotas).find(([prefixo]) => caminho.pathname.startsWith(prefixo));
  if (!entrada) return new Response(null, { status: 404 });
  const [prefixo, variavel] = entrada;
  const origem = Deno.env.get(variavel);
  if (!origem || !/^http:\/\/sso-s166-e2e-[0-9a-f]{12}-(auth|rest|storage):[0-9]+$/.test(origem)) return new Response(null, { status: 503 });
  const destino = new URL(caminho.pathname.slice(prefixo.length) + caminho.search, `${origem}/`);
  try { return await fetch(new Request(destino, request), { redirect: "manual", signal: AbortSignal.timeout(30_000) }); }
  catch { return new Response(null, { status: 503 }); }
});
