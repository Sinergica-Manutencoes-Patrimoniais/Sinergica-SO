import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarHandler, criarTransporteStorage } from "./handler.ts";

// Somente projeto Supabase local Sinergica-SO; nunca aceita URL hospedada.
Deno.test({ name: "transporte lê objeto sintético no Storage local e não revela caminho", ignore: Deno.env.get("SSO_TESTE_STORAGE_LOCAL") !== "1", fn: async () => {
  const status = await new Deno.Command("rtk", { args: ["proxy", "supabase", "status", "-o", "json"], stdout: "piped", stderr: "piped" }).output();
  if (!status.success) throw new Error("Supabase local indisponível");
  const texto = new TextDecoder().decode(status.stdout);
  const config = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1)) as { API_URL: string; SERVICE_ROLE_KEY: string };
  if (config.API_URL !== "http://127.0.0.1:55321" || !config.SERVICE_ROLE_KEY) throw new Error("Ambiente de teste não corresponde ao Supabase local");
  const caminho = `s184-teste-sintetico/${crypto.randomUUID()}/nota-teste.pdf`;
  const endereco = `${config.API_URL}/storage/v1/object/financeiro-comprovantes/${caminho.split("/").map(encodeURIComponent).join("/")}`;
  const headers = { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}` };
  const upload = await fetch(endereco, { method: "POST", headers: { ...headers, "Content-Type": "application/pdf" }, body: "%PDF-sintetico" });
  if (!upload.ok) {
    const erro = await upload.json().catch(() => ({})) as { error?: string };
    throw new Error(`Upload sintético falhou (${upload.status}; ${erro.error ?? "sem código"})`);
  }
  try {
    let verificacoes = 0;
    const handler = criarHandler({
      autenticar: async () => "usuario-sintetico", limitar: async () => true,
      resolver: async () => { verificacoes++; return caminho; },
      baixar: criarTransporteStorage(config.API_URL, config.SERVICE_ROLE_KEY), cors: () => ({}),
    });
    const resposta = await handler(new Request("http://localhost/", { method: "POST", body: JSON.stringify({ lancamentoId: "18410000-0000-4000-8000-000000000012" }) }));
    assertEquals(resposta.status, 200);
    assertEquals(await resposta.text(), "%PDF-sintetico");
    assertEquals(verificacoes, 2);
    assertEquals([...resposta.headers.values()].some((valor) => valor.includes(caminho)), false);
  } finally {
    const removido = await fetch(`${config.API_URL}/storage/v1/object/financeiro-comprovantes`, {
      method: "DELETE", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [caminho] }),
    });
    if (!removido.ok) throw new Error(`Limpeza do objeto sintético falhou (${removido.status})`);
  }
} });
