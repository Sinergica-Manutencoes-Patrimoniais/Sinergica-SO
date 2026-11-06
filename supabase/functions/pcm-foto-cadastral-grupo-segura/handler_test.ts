import { criarHandler, type Dependencias } from './handler.ts';
const id = '12345678-1234-1234-1234-123456789abc';
const png = new Uint8Array([137,80,78,71,13,10,26,10]);
const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', png)), n => n.toString(16).padStart(2, '0')).join('');
const referencia = { objetoId: id, nome: 'grupo/foto.png', digest: hash, verificada: true };
function ambiente() {
  let resolucoes = 0;
  let ref: typeof referencia | null = referencia;
  let auth = true;
  let bytes: Uint8Array<ArrayBuffer> = png;
  let storage = 0;
  const deps: Dependencias = {
    corsHeaders: () => ({}), url: 'http://localhost', chave: () => 'fixture', habilitada: () => 'true',
    identidade: async () => { if (!auth) throw Error(); return { userId: id, papel: 'gestor' }; },
    cliente: () => ({ schema: () => ({ rpc: async (nome: string, args: Record<string, unknown>) => {
      if (nome === 'fn_consumir_rate_limit_webhook') return { data: true };
      resolucoes++;
      if (args.p_cliente !== id || !ref) return { error: { code: '42501' } };
      return { data: ref };
    } }) }),
    fetch: async () => { storage++; return new Response(bytes); },
    timeoutCorpoMs: 5,
  };
  const req = (clienteId = id) => new Request('http://localhost', { method: 'POST', body: JSON.stringify({ clienteId, grupoId: id, fotoId: id }) });
  return { deps, req, setAuth: (v: boolean) => auth = v, setRef: (v: typeof referencia | null) => ref = v, setBytes: (v: Uint8Array<ArrayBuffer>) => bytes = v, get storage() { return storage; }, get resolucoes() { return resolucoes; } };
}
function igual(a: unknown, b: unknown) { if (a !== b) throw Error(`esperado ${b}, obtido ${a}`); }
Deno.test('autenticação e Cliente divergente negam antes do Storage', async () => {
  const a = ambiente(); a.setAuth(false); igual((await criarHandler(a.deps)(a.req())).status, 401); igual(a.storage, 0);
  a.setAuth(true); igual((await criarHandler(a.deps)(a.req('87654321-1234-1234-1234-123456789abc'))).status, 404); igual(a.storage, 0);
});
Deno.test('digest correto retorna bytes; alteração e revogação após download negam', async () => {
  const a = ambiente(); let r = await criarHandler(a.deps)(a.req()); igual(r.status, 200); igual(r.headers.get('X-SSO-Foto-Verificacao'), 'sha256'); igual(a.resolucoes, 2);
  a.setBytes(new Uint8Array([...png, 0])); igual((await criarHandler(a.deps)(a.req())).status, 409);
  a.setBytes(png); a.deps.fetch = async () => { a.setRef(null); return new Response(png); }; igual((await criarHandler(a.deps)(a.req())).status, 404);
});
Deno.test('limite e timeout de corpo falham fechados', async () => {
  const a = ambiente(); const h = criarHandler(a.deps);
  igual((await h(new Request('http://localhost', { method: 'POST', body: 'x'.repeat(4097) }))).status, 413);
  const stream = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); } });
  igual((await h(new Request('http://localhost', { method: 'POST', body: stream, duplex: 'half' } as RequestInit))).status, 408);
});
Deno.test('Storage excessivo e timeout não retornam conteúdo', async () => {
  const a = ambiente(); a.setBytes(new Uint8Array(10_485_761)); igual((await criarHandler(a.deps)(a.req())).status, 413);
  a.deps.timeoutStorageMs = 5; a.deps.fetch = (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Error('timeout'))));
  igual((await criarHandler(a.deps)(a.req())).status, 503);
});
