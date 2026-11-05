// Cliente sintético: envia requisição inteira e fecha o socket sem ler resposta.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve({ port: 9000 }, async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  try {
    const p = await req.json();
    if (!p || typeof p !== "object" || typeof p.host !== "string" || !/^sso-s166-e2e-[0-9a-f]{12}-upload$/.test(p.host) ||
      ![p.cliente, p.grupo, p.request].every((v) => typeof v === "string" && uuid.test(v)) ||
      typeof p.authorization !== "string" || !/^Bearer [A-Za-z0-9._-]+$/.test(p.authorization) ||
      typeof p.apikey !== "string" || !/^[A-Za-z0-9._-]+$/.test(p.apikey) ||
      typeof p.bytes !== "string" || p.bytes.length > 256) return new Response(null, { status: 422 });
    const bytes = Uint8Array.from(atob(p.bytes), (c) => c.charCodeAt(0));
    const cabecalho = new TextEncoder().encode(`POST / HTTP/1.1\r\nHost: ${p.host}:9000\r\nAuthorization: ${p.authorization}\r\napikey: ${p.apikey}\r\nContent-Type: image/png\r\nx-request-id: ${p.request}\r\nx-cliente-id: ${p.cliente}\r\nx-grupo-id: ${p.grupo}\r\nContent-Length: ${bytes.length}\r\nConnection: close\r\n\r\n`);
    const conn = await Deno.connect({ hostname: p.host, port: 9000 });
    try {
      for (const bloco of [cabecalho, bytes]) {
        let pos = 0;
        while (pos < bloco.length) { const n = await conn.write(bloco.subarray(pos)); if (n <= 0) throw new Error("escrita_incompleta"); pos += n; }
      }
    } finally { conn.close(); }
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 503 }); }
});
