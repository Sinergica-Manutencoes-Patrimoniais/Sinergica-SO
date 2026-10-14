import { type Locator, type Page, expect, test } from "@playwright/test";

async function conferirAjuda(page: Page, link: Locator, assunto: string, titulo: string) {
  const [manual] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await expect(manual).toHaveURL(new RegExp(`\\?guia=pcm#pcm-${assunto}$`));
  await expect(manual.getByRole("heading", { name: titulo, exact: true })).toBeVisible();
  await manual.close();
}

test("AC-5, AC-6: ajuda da OS abre assunto correto e preserva o formulário", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PCM · Operação", exact: true }).first().click();
  await page.getByRole("button", { name: "Chamados", exact: true }).click();
  await page.getByRole("button", { name: "Nova OS", exact: true }).click();
  const formulario = page.getByRole("dialog");
  const campoTitulo = formulario.getByPlaceholder("Ex: Reparo vazamento tubulação — Térreo");
  await campoTitulo.fill("Rascunho de leitura — não salvar");
  const ajuda = formulario.getByRole("link", { name: /Como abrir e encaminhar uma OS/ });
  await expect(ajuda).toHaveAttribute("target", "_blank");
  await expect(ajuda).toHaveAttribute("rel", "noopener noreferrer");
  const [manual] = await Promise.all([page.waitForEvent("popup"), ajuda.click()]);
  await expect(
    manual.getByRole("heading", { name: "Abrir OS e encaminhar ao campo" }),
  ).toBeVisible();
  await expect(manual).toHaveURL(/\?guia=pcm#pcm-os$/);
  await manual.screenshot({ path: "/tmp/sinergica-manual-desktop.png", fullPage: true });
  await expect(campoTitulo).toHaveValue("Rascunho de leitura — não salvar");
  await expect(formulario).toBeVisible();
  await manual.close();
});

test("AC-3, AC-6: consulta etiqueta por teclado e mobile sem gravar dados", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?guia=pcm#pcm-componentes");
  await expect(page.getByRole("heading", { name: "Cadastrar e editar Componentes" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar no manual" }).fill("etiqueta");
  const link = page
    .getByRole("navigation", { name: "Assuntos do manual" })
    .getByRole("link", { name: "Preencher o Identificador e conferir etiquetas" });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Preencher o Identificador e conferir etiquetas" }),
  ).toBeFocused();
  const duvida = page.locator("summary").filter({ hasText: "As sugestões aparecem" });
  await duvida.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Se continuar com traço, não imprima etiqueta/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "/tmp/sinergica-manual-mobile.png", fullPage: true });
});

test("AC-5: ajuda contextual do 360 e dos cadastros chega aos roteiros sem salvar", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const nomeCliente = process.env.E2E_CLIENTE_360_NOME_A;
  if (!nomeCliente)
    throw new Error("Configure a fixture E2E_CLIENTE_360_NOME_A para conferir a ajuda no 360.");

  await page.goto("/");
  await page.getByRole("button", { name: "PCM · Operação", exact: true }).first().click();
  await page.getByRole("button", { name: "Chamados", exact: true }).click();
  await conferirAjuda(
    page,
    page.getByRole("link", { name: /Manual de Chamados e OS/ }),
    "inicio",
    "Começar o dia e escolher o fluxo",
  );

  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page
    .getByPlaceholder("Buscar por cliente, cidade, contato, CNPJ ou ID Auvo")
    .fill(nomeCliente);
  await page.getByRole("button", { name: nomeCliente, exact: true }).click();
  await conferirAjuda(
    page,
    page.getByRole("link", { name: /Como trabalhar pelo Cliente 360/ }),
    "cliente-360",
    "Trabalhar pelo Cliente 360",
  );

  await page.getByRole("button", { name: "Novo chamado", exact: true }).click();
  let modal = page.getByRole("dialog");
  await conferirAjuda(
    page,
    modal.getByRole("link", { name: /Como abrir e tratar um Chamado/ }),
    "chamados",
    "Abrir e tratar um Chamado",
  );
  await modal.getByRole("button", { name: "Fechar", exact: true }).click();

  await page.getByRole("button", { name: "Novo componente", exact: true }).click();
  modal = page.getByRole("dialog");
  await conferirAjuda(
    page,
    modal.getByRole("link", { name: /Ajuda com cadastro e etiquetas/ }),
    "componentes",
    "Cadastrar e editar Componentes",
  );
  await modal.getByRole("button", { name: "Fechar", exact: true }).click();

  await page
    .getByLabel("Áreas do Cliente")
    .getByRole("button", { name: "Sistemas", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo sistema", exact: true }).click();
  modal = page.getByRole("dialog");
  await conferirAjuda(
    page,
    modal.getByRole("link", { name: /Ajuda com Sistemas e composição/ }),
    "sistemas",
    "Cadastrar Sistemas e sua composição",
  );
  await modal.getByRole("button", { name: "Fechar", exact: true }).click();
});
