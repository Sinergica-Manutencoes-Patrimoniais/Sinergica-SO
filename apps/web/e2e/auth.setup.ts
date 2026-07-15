import { expect, test as setup } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("autentica e salva sessão", async ({ page }) => {
  const email = process.env.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("SUPABASE_TEST_EMAIL/SUPABASE_TEST_PASSWORD ausentes no .env.local");
  }

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Carregando sessão...")).not.toBeVisible({ timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: authFile });
});
