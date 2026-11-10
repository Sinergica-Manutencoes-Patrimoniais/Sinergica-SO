import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// Projeto e portas fixos; credencial administrativa permanece no processo Node.
const dir = "/Users/lucasazevedo/sso-comprovantes-AmwvLX";
const texto = execFileSync("rtk", ["proxy", "supabase", "status", "--workdir", dir, "-o", "json"], {
  encoding: "utf8",
  timeout: 30_000,
  stdio: ["ignore", "pipe", "ignore"],
  env: {
    ...process.env,
    DOCKER_CONFIG: "/tmp/sinergica-codex-docker-no-config",
    DOCKER_HOST: "unix:///Users/lucasazevedo/.colima/default/docker.sock",
  },
});
const config = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1)) as {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};
if (config.API_URL !== "http://127.0.0.1:56321") throw new Error("Projeto isolado inválido.");
const admin = {
  apikey: config.SERVICE_ROLE_KEY,
  Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};
function sql(comando: string) {
  execFileSync(
    "rtk",
    [
      "proxy",
      "docker",
      "exec",
      "-i",
      "supabase_db_sso-comprovantes-isolado",
      "psql",
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-c",
      comando,
    ],
    {
      timeout: 10_000,
      stdio: "ignore",
      env: {
        ...process.env,
        DOCKER_CONFIG: "/tmp/sinergica-codex-docker-no-config",
        DOCKER_HOST: "unix:///Users/lucasazevedo/.colima/default/docker.sock",
      },
    },
  );
}

test("tela real baixa comprovante e recusa acesso revogado na mesma sessão", async ({ page }) => {
  // As fixtures sintéticas e seus eventos de auditoria ficam no volume descartável, mesmo em
  // falha parcial. Auditoria é append-only: não apagar registros nem fazer reset neste roteiro.
  const email = `tela-comprovante-${randomUUID()}@example.test`;
  const senha = `${randomUUID()}aA1!`;
  const criado = await fetch(`${config.API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email, password: senha, email_confirm: true }),
  });
  expect(criado.status).toBe(200);
  const usuario = (await criado.json()) as { id: string };
  expect(usuario.id).toMatch(/^[0-9a-f-]{36}$/);
  const categoria = randomUUID();
  const lancamento = randomUUID();
  const objeto = `${lancamento}/${randomUUID()}.pdf`;
  const descricao = `Comprovante sintético ${lancamento}`;
  sql(`insert into config.usuarios(user_id, papel, nome, ativo) values ('${usuario.id}', 'colaborador', 'Teste tela comprovante', true) on conflict (user_id) do update set papel = 'colaborador', ativo = true;
    insert into config.usuario_modulos(user_id, modulo, nivel) values ('${usuario.id}', 'financeiro', 'escrita') on conflict (user_id, modulo) do update set nivel = 'escrita';
    insert into financeiro.categorias(id, nome, tipo) values ('${categoria}', 'Categoria sintética ${categoria}', 'entrada');
    insert into financeiro.lancamentos(id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, comprovante_path, descricao)
      values ('${lancamento}', 'entrada', 'previsto', 100, '2026-10-01', '2026-10-01', '${categoria}', '${objeto}', '${descricao}');`);
  const conteudo = "%PDF-1.7\ncomprovante sintetico";
  const upload = await fetch(
    `${config.API_URL}/storage/v1/object/financeiro-comprovantes/${objeto}`,
    {
      method: "POST",
      headers: { ...admin, "Content-Type": "application/pdf" },
      body: conteudo,
    },
  );
  expect(upload.status).toBe(200);

  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && ["5189", "56321"].includes(url.port)
      ? route.continue()
      : route.abort();
  });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("banner").getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  const linha = page.getByRole("row").filter({ hasText: descricao });
  await expect(linha).toBeVisible({ timeout: 20_000 });
  const downloadPromessa = page.waitForEvent("download");
  await linha.getByRole("button", { name: "Baixar comprovante" }).click();
  const download = await downloadPromessa;
  expect(download.suggestedFilename()).toBe("comprovante.pdf");
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Download não disponível.");
  let baixado = "";
  for await (const parte of stream) baixado += parte.toString();
  expect(baixado).toBe(conteudo);

  sql(
    `delete from config.usuario_modulos where user_id = '${usuario.id}' and modulo = 'financeiro';`,
  );
  let downloads = 0;
  page.on("download", () => {
    downloads += 1;
  });
  const resposta = page.waitForResponse(
    (r) =>
      r.url().endsWith("/functions/v1/financeiro-comprovante-seguro") &&
      r.request().method() === "POST",
  );
  await linha.getByRole("button", { name: "Baixar comprovante" }).click();
  expect((await resposta).status()).toBe(404);
  await expect(page.getByText(/Edge Function returned a non-2xx status code/i)).toBeVisible();
  expect(downloads).toBe(0);
});
