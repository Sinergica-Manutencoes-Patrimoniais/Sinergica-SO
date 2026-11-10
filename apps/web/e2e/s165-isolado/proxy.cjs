// Servidor do navegador sintético. Somente rede interna já atestada pelo bootstrap.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const id = process.env.SSO_RECORTE_ID;
if (!/^[0-9a-f]{12}$/.test(id || "")) throw new Error("identidade_invalida");
const base = "/tmp/s165-dist";
const destinos = { "/auth/v1/": ["auth", 9999], "/rest/v1/": ["rest", 3000] };
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  if (!req.url || !req.url.startsWith("/") || req.url.startsWith("//")) { res.writeHead(400).end(); return; }
  const url = new URL(req.url, "http://127.0.0.1:5189");
  const prefixo = Object.keys(destinos).find((p) => url.pathname.startsWith(p));
  if (prefixo) {
    const [papel, porta] = destinos[prefixo];
    const host = `sso-recorte-${id}-${papel}`;
    const upstream = http.request({ hostname: host, port: porta, method: req.method,
      path: "/" + url.pathname.slice(prefixo.length) + url.search,
      headers: { ...req.headers, host }, timeout: 30_000 }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers); r.pipe(res);
    });
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
  let nome;
  try { nome = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  if (nome.includes("\0") || nome.includes("\\")) { res.writeHead(400).end(); return; }
  let arquivo = path.resolve(base, "." + nome);
  if (arquivo !== base && !arquivo.startsWith(base + "/")) { res.writeHead(403).end(); return; }
  if (!path.extname(arquivo)) arquivo = path.join(base, "index.html");
  fs.realpath(arquivo, (erro, real) => {
    if (erro || !real.startsWith(base + "/")) { res.writeHead(404).end(); return; }
    fs.readFile(real, (falha, dados) => {
      if (falha) { res.writeHead(404).end(); return; }
      res.setHeader("Content-Type", mime[path.extname(real)] || "application/octet-stream");
      res.end(req.method === "HEAD" ? undefined : dados);
    });
  });
}).listen(5189, "127.0.0.1");
