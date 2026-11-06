import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

// Executar apenas com projeto descartável sso-comprovantes-isolado na porta 56321.
Deno.test({ name: "Auth, Storage e rota HTTP verificam permissão atual sem link assinado", ignore: Deno.env.get("SSO_TESTE_PILHA_ISOLADA") !== "1", fn: async () => {
  const dir = Deno.env.get("SSO_PILHA_DIR");
  if (!dir) throw new Error("Informe o diretório da pilha isolada.");
  const status = await new Deno.Command("rtk", { args: ["proxy", "supabase", "status", "--workdir", dir, "-o", "json"], stdout: "piped", stderr: "piped" }).output();
  if (!status.success) throw new Error("Pilha isolada indisponível.");
  const texto = new TextDecoder().decode(status.stdout);
  const config = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1)) as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
  if (config.API_URL !== "http://127.0.0.1:56321") throw new Error("Pilha não corresponde ao ambiente isolado.");
  const headersAdmin = { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const email = `comprovante-${crypto.randomUUID()}@example.test`;
  const senha = `${crypto.randomUUID()}aA1!`;
  const criado = await fetch(`${config.API_URL}/auth/v1/admin/users`, { method: "POST", headers: headersAdmin,
    body: JSON.stringify({ email, password: senha, email_confirm: true }) });
  if (!criado.ok) throw new Error(`Criação de usuário sintético falhou (${criado.status}).`);
  const usuario = (await criado.json()) as { id: string };
  if (!/^[0-9a-f-]{36}$/.test(usuario.id)) throw new Error("Identidade sintética inválida.");
  const categoria = crypto.randomUUID();
  const lancamento = crypto.randomUUID();
  const objeto = `${lancamento}/${crypto.randomUUID()}.pdf`;
  const sql = `insert into config.usuarios(user_id, papel, nome, ativo) values ('${usuario.id}', 'colaborador', 'Teste comprovante', true) on conflict (user_id) do update set papel = 'colaborador', ativo = true;
    insert into config.usuario_modulos(user_id, modulo, nivel) values ('${usuario.id}', 'financeiro', 'escrita') on conflict (user_id, modulo) do update set nivel = 'escrita';
    insert into financeiro.categorias(id, nome, tipo) values ('${categoria}', 'Categoria sintética ${categoria}', 'entrada');
    insert into financeiro.lancamentos(id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, comprovante_path)
      values ('${lancamento}', 'entrada', 'previsto', 100, '2026-10-01', '2026-10-01', '${categoria}', '${objeto}');`;
  async function executarSql(comando: string) {
    const r = await new Deno.Command("rtk", { args: ["proxy", "docker", "exec", "-i", "supabase_db_sso-comprovantes-isolado", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres", "-c", comando], stdout: "piped", stderr: "piped" }).output();
    if (!r.success) throw new Error("Não foi possível preparar os dados sintéticos no banco isolado.");
  }
  await executarSql(sql);
  const upload = await fetch(`${config.API_URL}/storage/v1/object/financeiro-comprovantes/${objeto}`, { method: "POST",
    headers: { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`, "Content-Type": "application/pdf" }, body: "comprovante sintético" });
  if (!upload.ok) throw new Error(`Upload sintético falhou (${upload.status}).`);
  const login = await fetch(`${config.API_URL}/auth/v1/token?grant_type=password`, { method: "POST",
    headers: { apikey: config.ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: senha }) });
  if (!login.ok) throw new Error(`Autenticação sintética falhou (${login.status}).`);
  const sessao = (await login.json()) as { access_token: string };
  const limite = await fetch(`${config.API_URL}/rest/v1/rpc/fn_consumir_rate_limit_webhook`, { method: "POST",
    headers: { ...headersAdmin, "Content-Profile": "atendimento" }, body: JSON.stringify({ p_chave: `teste-comprovante:${usuario.id}`, p_limite: 60, p_janela_segundos: 60 }) });
  if (!limite.ok) throw new Error(`Rate limit isolado indisponível (${limite.status}): ${(await limite.json()).code ?? "erro"}.`);
  const referencia = await fetch(`${config.API_URL}/rest/v1/rpc/sso_comprovante_autorizado`, { method: "POST",
    headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${sessao.access_token}`, "Content-Type": "application/json", "Content-Profile": "financeiro" },
    body: JSON.stringify({ p_lancamento_id: lancamento }) });
  if (!referencia.ok) throw new Error(`Consulta autorizada isolada indisponível (${referencia.status}): ${(await referencia.json()).code ?? "erro"}.`);
  const arquivo = await fetch(`${config.API_URL}/storage/v1/object/authenticated/financeiro-comprovantes/${objeto}`, {
    headers: { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}` } });
  if (!arquivo.ok) throw new Error(`Leitura de Storage isolado indisponível (${arquivo.status}).`);
  const consultar = () => fetch(`${config.API_URL}/functions/v1/financeiro-comprovante-seguro`, { method: "POST",
    headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${sessao.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ lancamentoId: lancamento }) });
  const permitido = await consultar();
  assertEquals(permitido.status, 200);
  assertEquals(await permitido.text(), "comprovante sintético");
  assertEquals(permitido.headers.get("cache-control"), "private, no-store");
  const sdk = createClient(config.API_URL, config.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const respostaSdk = await sdk.functions.invoke<Blob>("financeiro-comprovante-seguro", {
    headers: { Authorization: `Bearer ${sessao.access_token}` }, body: { lancamentoId: lancamento },
  });
  assertEquals(respostaSdk.error, null);
  assertEquals(respostaSdk.data instanceof Blob, true);
  assertEquals(await respostaSdk.data!.text(), "comprovante sintético");
  const envioPermitido = await fetch(`${config.API_URL}/storage/v1/object/financeiro-comprovantes/${lancamento}/teste-upload.pdf`, { method: "POST",
    headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${sessao.access_token}`, "Content-Type": "application/pdf" }, body: "upload sintético" });
  assertEquals(envioPermitido.status, 200);
  const assinaturaDireta = await fetch(`${config.API_URL}/storage/v1/object/sign/financeiro-comprovantes/${objeto}`, { method: "POST",
    headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${sessao.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
  assertEquals(assinaturaDireta.ok, false);
  // Emula um link emitido antes do bloqueio, com credencial do serviço apenas no ambiente sintético.
  const assinatura = await fetch(`${config.API_URL}/storage/v1/object/sign/financeiro-comprovantes/${objeto}`, { method: "POST",
    headers: headersAdmin, body: JSON.stringify({ expiresIn: 60 }) });
  assertEquals(assinatura.status, 200);
  const assinado = (await assinatura.json()) as { signedURL: string };
  if (!assinado.signedURL?.startsWith("/object/sign/")) throw new Error("Resposta de assinatura inesperada no ambiente isolado.");
  await executarSql(`delete from config.usuario_modulos where user_id = '${usuario.id}' and modulo = 'financeiro';`);
  const revogado = await consultar();
  assertEquals(revogado.status, 404);
  assertEquals((await revogado.text()).includes("comprovante sintético"), false);
  const urlAnterior = await fetch(`${config.API_URL}/storage/v1${assinado.signedURL}`);
  assertEquals(urlAnterior.status, 200);
  assertEquals(await urlAnterior.text(), "comprovante sintético");
} });
