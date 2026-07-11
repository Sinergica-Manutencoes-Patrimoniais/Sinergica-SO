import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function fonte(relativo: string): string {
  return readFileSync(new URL(relativo, import.meta.url), "utf8");
}

describe("E01-S60 — contrato visual V1", () => {
  it("mantém primitives compartilhadas de densidade, foco, modal e estados", () => {
    const css = fonte("../index.css");

    expect(css).toContain(".btn-primary");
    expect(css).toContain(".btn-secondary");
    expect(css).toContain(".surface-card");
    expect(css).toContain(".empty-state");
    expect(css).toContain(":focus-visible");
  });

  it("oferece drawer móvel sem reduzir a largura do conteúdo", () => {
    const home = fonte("./HomePage.tsx");

    expect(home).toContain('aria-label="Abrir menu"');
    expect(home).toContain('aria-label="Fechar menu"');
    expect(home).toContain("-translate-x-full");
    expect(home).toContain("lg:static");
    expect(home).toContain("p-3 sm:p-4 lg:p-5");
    expect(home).toContain("sidebarCollapsed && !mobileSidebarOpen");
  });

  it("mantém login seguro, responsivo e com autocomplete correto", () => {
    const login = fonte("../features/auth/pages/LoginPage.tsx");

    expect(login).toContain('autoComplete="email"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).toContain("lg:grid-cols-");
    expect(login).toContain('role="alert"');
  });

  it("não empilha lista, chat e perfil simultaneamente no inbox móvel", () => {
    const inbox = fonte("../features/atendimento/pages/AtendimentoInboxPage.tsx");

    expect(inbox).toContain('conversaSelecionada ? "hidden xl:block"');
    expect(inbox).toContain("Voltar às conversas");
    expect(inbox).toContain('conversaSelecionada ? "xl:grid-cols-[300px_1fr_260px]"');
  });

  it("não expõe erro técnico de Edge Function no dashboard de atendimento", () => {
    const dashboardAtendimento = fonte(
      "../features/atendimento/pages/AtendimentoDashboardPage.tsx",
    );

    expect(dashboardAtendimento).toContain("Não foi possível conectar ao serviço de métricas");
    expect(dashboardAtendimento).toContain("mensagemErroDashboard(error)");
  });

  it("torna os resumos de OS focáveis por teclado", () => {
    const dashboard = fonte("../features/pcm/pages/PcmDashboardPage.tsx");

    expect(dashboard.match(/aria-label=\{`Resumo da OS/g)).toHaveLength(2);
    expect(dashboard).toContain("Resumo da OS");
  });
});
