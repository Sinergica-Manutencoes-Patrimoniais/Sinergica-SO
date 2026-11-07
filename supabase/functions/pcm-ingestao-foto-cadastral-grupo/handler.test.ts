import { processarFotoCadastral, type Dependencias } from "./handler.ts";

const actor = "10000000-0000-4000-8000-000000000001";
const cliente = "10000000-0000-4000-8000-000000000002";
const grupo = "10000000-0000-4000-8000-000000000003";
const request = "10000000-0000-4000-8000-000000000004";
const objeto = "10000000-0000-4000-8000-000000000005";
const foto = "10000000-0000-4000-8000-000000000006";
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]);
function equal(a: unknown, b: unknown) { if (a !== b) throw new Error(`Esperado ${b}, obtido ${a}`); }
function entrada(bytes: Uint8Array = png, headers: Record<string, string> = {}) {
  return new Request("http://local/", { method: "POST", headers: { "x-request-id": request, "x-cliente-id": cliente, "x-grupo-id": grupo, ...headers }, body: Uint8Array.from(bytes).buffer });
}
function setup() {
  const eventos: string[] = [];
  const parametros: Record<string, unknown>[] = [];
  const nome = `${cliente}/${grupo}/${objeto}`;
  const rpc = (_: string, args: Record<string, unknown>) => {
    if (!args.p_operacao) return Promise.resolve({ data: true, error: null });
    parametros.push(args); eventos.push(String(args.p_operacao));
    return Promise.resolve({ data: args.p_operacao === "reservar" ? { estado: "pendente", nome } : args.p_operacao === "recuperar" ? { nome, objetoId: objeto } : { estado: "concluida", requestId: request, fotoId: foto }, error: null });
  };
  const deps = { url: "http://local", identidade: async () => ({ userId: actor, papel: "superadmin" }), corsHeaders: () => ({}), enabled: () => "true", servico: () => ({ schema: () => ({ rpc }) }), chave: () => "synthetic", fetch: async (_url: string | URL | Request, init?: RequestInit) => { eventos.push(init?.method === "POST" ? "upload" : "download"); return new Response(init?.method === "POST" ? null : Uint8Array.from(png).buffer); } } as unknown as Dependencias;
  return { deps, eventos, parametros };
}
Deno.test("autenticação e limites rejeitam antes de gravar", async () => {
  const x = setup(); x.deps.identidade = async () => { throw new Error("sem acesso"); };
  equal((await processarFotoCadastral(entrada(), x.deps)).status, 401); equal(x.eventos.length, 0);
  const y = setup(); equal((await processarFotoCadastral(entrada(png, { "x-grupo-id": "inválido" }), y.deps)).status, 422); equal(y.eventos.length, 0);
  equal((await processarFotoCadastral(entrada(new Uint8Array(10_485_761)), y.deps)).status, 413); equal(y.eventos.length, 0);
  equal((await processarFotoCadastral(entrada(new Uint8Array([1, 2])), y.deps)).status, 415);
});
Deno.test("upload incerto é recuperado, bytes conferidos e reserva confirmada", async () => {
  const x = setup(); const original = x.deps.fetch; x.deps.fetch = async (url, init) => { if (init?.method === "POST") { x.eventos.push("upload-incerto"); throw new Error("rede"); } return original(url, init); };
  const res = await processarFotoCadastral(entrada(), x.deps); equal(res.status, 200); equal(x.eventos.join(","), "reservar,upload-incerto,recuperar,download,confirmar");
  const esperado = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", png)), n => n.toString(16).padStart(2,"0")).join(""); equal(x.parametros[0].p_digest, esperado); equal(x.parametros[2].p_objeto, objeto);
});
Deno.test("digest divergente impede confirmação", async () => {
  const x = setup(); const original = x.deps.fetch; x.deps.fetch = async (url, init) => init?.method === "POST" ? original(url, init) : new Response(new Uint8Array([1, 2]));
  equal((await processarFotoCadastral(entrada(), x.deps)).status, 409); equal(x.eventos.includes("confirmar"), false);
});
Deno.test("replay concluído não envia arquivo ou grava de novo", async () => {
  const x = setup(); x.deps.servico = (() => ({ schema: () => ({ rpc: (_: string, args: Record<string, unknown>) => { if (!args.p_operacao) return Promise.resolve({ data: true, error: null }); x.eventos.push(String(args.p_operacao)); return Promise.resolve({ data: { estado: "concluida", fotoId: foto }, error: null }); } }) })) as unknown as Dependencias["servico"];
  equal((await processarFotoCadastral(entrada(), x.deps)).status, 200); equal(x.eventos.join(","), "reservar");
});
Deno.test("conflito de reserva não faz upload", async () => {
  const x = setup(); x.deps.servico = (() => ({ schema: () => ({ rpc: (_: string, args: Record<string, unknown>) => Promise.resolve(args.p_operacao ? { data: null, error: { code: "23505" } } : { data: true, error: null }) }) })) as unknown as Dependencias["servico"];
  equal((await processarFotoCadastral(entrada(), x.deps)).status, 409); equal(x.eventos.length, 0);
});
Deno.test("permissão revogada retorna indisponível sem enviar bytes", async () => {
  const x = setup(); x.deps.servico = (() => ({ schema: () => ({ rpc: (_: string, args: Record<string, unknown>) => Promise.resolve(args.p_operacao ? { data: null, error: { code: "42501" } } : { data: true, error: null }) }) })) as unknown as Dependencias["servico"];
  equal((await processarFotoCadastral(entrada(), x.deps)).status, 404); equal(x.eventos.length, 0);
});
