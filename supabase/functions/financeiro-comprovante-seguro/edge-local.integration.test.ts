import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Apenas containers sintéticos locais: API 55321 e Edge Runtime isolado 56380.
Deno.test({ name: "Edge local entrega comprovante e nega após revogação real no banco", ignore: Deno.env.get("SSO_TESTE_EDGE_LOCAL") !== "1", fn: async () => {
  const status = await new Deno.Command("rtk", { args: ["proxy", "supabase", "status", "-o", "json"], stdout: "piped", stderr: "piped" }).output();
  if (!status.success) throw new Error("Supabase local indisponível");
  const texto = new TextDecoder().decode(status.stdout);
  const config = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1)) as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
  if (config.API_URL !== "http://127.0.0.1:55321") throw new Error("API não corresponde ao ambiente local");
  const inspecao = await new Deno.Command("rtk", { args: ["proxy", "docker", "inspect", "sso-s184-edge-isolado-20261030", "--format", "{{.State.Running}}"], stdout: "piped", stderr: "piped" }).output();
  if (!inspecao.success || new TextDecoder().decode(inspecao.stdout).trim() !== "true") throw new Error("Edge isolado indisponível");
  const admin = { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const email = `s184-${crypto.randomUUID()}@example.test`, senha = `${crypto.randomUUID()}aA1!`;
  const categoria = crypto.randomUUID(), lancamento = crypto.randomUUID();
  const caminho = `s184-edge-sintetico/${lancamento}/nota.pdf`;
  const caminhoGrande = `s184-edge-sintetico/${lancamento}/limite.pdf`;
  const criado = await fetch(`${config.API_URL}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password: senha, email_confirm: true }) });
  if (!criado.ok) throw new Error(`Usuário sintético não criado (${criado.status})`);
  const usuario = (await criado.json() as { id: string }).id;
  if (!/^[0-9a-f-]{36}$/.test(usuario)) throw new Error("Identidade sintética inválida");
  async function sql(comando: string) {
    const r = await new Deno.Command("rtk", { args: ["proxy", "docker", "exec", "supabase_db_Sinergica-SO", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres", "-c", comando], stdout: "piped", stderr: "piped" }).output();
    if (!r.success) throw new Error("Falha ao preparar ou remover dados sintéticos");
  }
  const objetosCriados: string[] = [];
  try {
    await sql(`insert into config.usuarios(user_id,papel,nome,ativo) values ('${usuario}','colaborador','Teste S184',true) on conflict(user_id) do update set papel='colaborador',ativo=true;
      insert into config.usuario_modulos(user_id,modulo,nivel) values ('${usuario}','financeiro','leitura') on conflict(user_id,modulo) do update set nivel='leitura';
      insert into financeiro.categorias(id,nome,tipo) values ('${categoria}','Categoria S184 ${categoria}','entrada');
      insert into financeiro.lancamentos(id,tipo,status,valor_centavos,data_competencia,data_vencimento,categoria_id,comprovante_path) values ('${lancamento}','entrada','previsto',100,'2026-10-01','2026-10-01','${categoria}','${caminho}');`);
    const upload = await fetch(`${config.API_URL}/storage/v1/object/financeiro-comprovantes/${caminho}`, { method: "POST", headers: { ...admin, "Content-Type": "application/pdf" }, body: "%PDF-edge-sintetico" });
    if (!upload.ok) throw new Error(`Upload sintético recusado (${upload.status})`);
    objetosCriados.push(caminho);
    const login = await fetch(`${config.API_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: config.ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: senha }) });
    if (!login.ok) throw new Error(`Login sintético recusado (${login.status})`);
    const token = (await login.json() as { access_token: string }).access_token;
    const semToken = await fetch("http://127.0.0.1:56380/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lancamentoId: lancamento }) });
    assertEquals(semToken.status, 401);
    const consultar = () => fetch("http://127.0.0.1:56380/", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ lancamentoId: lancamento }) });
    const permitido = await consultar();
    assertEquals(permitido.status, 200);
    assertEquals(await permitido.text(), "%PDF-edge-sintetico");
    assertEquals(permitido.headers.get("cache-control"), "private, no-store");
    const uploadGrande = await fetch(`${config.API_URL}/storage/v1/object/financeiro-comprovantes/${caminhoGrande}`, { method: "POST", headers: { ...admin, "Content-Type": "application/pdf" }, body: new Uint8Array(10 * 1024 * 1024) });
    if (!uploadGrande.ok) throw new Error(`Upload no limite recusado (${uploadGrande.status})`);
    objetosCriados.push(caminhoGrande);
    await sql(`update financeiro.lancamentos set comprovante_path='${caminhoGrande}' where id='${lancamento}';`);
    const noLimite = await consultar();
    assertEquals(noLimite.status, 200);
    assertEquals((await noLimite.arrayBuffer()).byteLength, 10 * 1024 * 1024);
    await sql(`delete from config.usuario_modulos where user_id='${usuario}' and modulo='financeiro';`);
    const revogado = await consultar();
    assertEquals(revogado.status, 404);
    assertEquals((await revogado.text()).includes("%PDF-edge-sintetico"), false);
  } finally {
    if (objetosCriados.length) {
      const remover = await fetch(`${config.API_URL}/storage/v1/object/financeiro-comprovantes`, { method: "DELETE", headers: admin, body: JSON.stringify({ prefixes: objetosCriados }) });
      if (!remover.ok) throw new Error(`Limpeza do objeto sintético falhou (${remover.status})`);
    }
    await sql(`delete from financeiro.lancamentos where id='${lancamento}'; delete from financeiro.categorias where id='${categoria}'; delete from atendimento.webhook_rate_limits where chave='comprovante:${usuario}'; delete from config.usuario_modulos where user_id='${usuario}'; delete from config.usuarios where user_id='${usuario}';`);
    const removerUsuario = await fetch(`${config.API_URL}/auth/v1/admin/users/${usuario}`, { method: "DELETE", headers: admin });
    if (!removerUsuario.ok) throw new Error(`Limpeza do usuário sintético falhou (${removerUsuario.status})`);
  }
} });
