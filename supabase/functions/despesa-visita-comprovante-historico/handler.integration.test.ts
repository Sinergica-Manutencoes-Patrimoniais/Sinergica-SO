import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarHandler } from "./handler.ts";

// Doubles locais apenas: não iniciam Supabase, Storage, HTTP externo ou chamadas reais.
const despesaA = "18010000-0000-4000-8000-000000000051";
const despesaB = "18010000-0000-4000-8000-000000000052";
function requisicao(despesaId = despesaA) {
 return new Request("http://localhost/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ despesaId, revisao: 2 }) });
}
function dependencias(overrides: Partial<Parameters<typeof criarHandler>[0]> = {}) {
 return { autenticar: async (_req: Request) => "usuario-a", limitar: async (_usuario: string) => true,
  resolver: async (_req: Request, id: string, _revisao: number) => id === despesaA ? "privado/objeto" : null,
  baixar: async (_caminho: string) => new Blob(["comprovante privado"]),
  auditar: async (_req: Request, _requestId: string, _despesaId: string, _revisao: number) => true,
  cors: (_origem: string | null) => ({}), ...overrides };
}

Deno.test("histórico entrega bytes somente após autorização, revalidação e auditoria", async () => {
 let autorizacoes = 0, auditorias = 0;
 const handler = criarHandler(dependencias({ resolver: async () => { autorizacoes++; return "privado/objeto"; }, auditar: async () => { auditorias++; return true; } }));
 const r = await handler(requisicao());
 assertEquals(r.status, 200); assertEquals(await r.text(), "comprovante privado");
 assertEquals(autorizacoes, 2); assertEquals(auditorias, 1); assertEquals(r.headers.get("cache-control"), "private, no-store");
 assertEquals(r.headers.get("content-disposition"), 'attachment; filename="comprovante"');
});

Deno.test("despesa de outra Conta não entrega conteúdo nem consulta Storage", async () => {
 let downloads = 0;
 const r = await criarHandler(dependencias({ baixar: async () => { downloads++; return new Blob(["não deve sair"]); } }))(requisicao(despesaB));
 assertEquals(r.status, 404); assertEquals(downloads, 0); assertEquals((await r.text()).includes("privado/objeto"), false);
});

Deno.test("revogação entre leitura e resposta impede entrega do arquivo", async () => {
 let consultas = 0, auditorias = 0;
 const r = await criarHandler(dependencias({ resolver: async () => ++consultas === 1 ? "privado/objeto" : null, auditar: async () => { auditorias++; return true; } }))(requisicao());
 assertEquals(r.status, 404); assertEquals(auditorias, 0); assertEquals((await r.text()).includes("comprovante privado"), false);
});

Deno.test("falha na auditoria impede envio após baixar", async () => {
 const r = await criarHandler(dependencias({ auditar: async () => false }))(requisicao());
 assertEquals(r.status, 404); assertEquals((await r.text()).includes("comprovante privado"), false);
});

Deno.test("sessão inválida não consulta dados privados", async () => {
 let consultas = 0;
 const r = await criarHandler(dependencias({ autenticar: async () => { throw new Error("sessão revogada"); }, resolver: async () => { consultas++; return null; } }))(requisicao());
 assertEquals(r.status, 401); assertEquals(consultas, 0);
});

Deno.test("falha de Storage é sanitizada e não retorna caminho privado", async () => {
 const r = await criarHandler(dependencias({ baixar: async () => { throw new Error("privado/objeto: detalhe interno"); } }))(requisicao());
 assertEquals(r.status, 503); const corpo = await r.text(); assertStringIncludes(corpo, "Não foi possível consultar"); assertEquals(corpo.includes("privado/objeto"), false);
});
