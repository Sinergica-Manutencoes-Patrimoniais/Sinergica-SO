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

  it("não exibe relatórios PCM sem tela funcional", () => {
    const home = fonte("./HomePage.tsx");

    expect(home).not.toContain('label: "Relatório Diário"');
    expect(home).not.toContain('label: "Relatório Mensal"');
  });

  it("organiza PMOC e tipos de tarefa sem manter o grupo preventivo morto", () => {
    const home = fonte("./HomePage.tsx");

    expect(home).toMatch(
      /titulo: "OPERAÇÃO",[\s\S]{0,1200}label: "PMOC", icon: Snowflake, view: "pmoc"/,
    );
    expect(home).toMatch(
      /titulo: "CONFIGURAÇÕES",[\s\S]{0,1800}label: "Tipos de Tarefa", icon: ClipboardList, view: "tipos-tarefa"/,
    );
    // Escopa ao corpo do array de CADASTROS (até o primeiro fechamento `],`) em vez de uma
    // distância fixa de caracteres — E01-S104 adicionou "Ferramentas" ao grupo e um limiar fixo
    // (800) vira falso positivo a cada item novo, sem checar se "Tipos de Tarefa" está de fato
    // dentro do array.
    const cadastros = home.match(/titulo: "CADASTROS",[\s\S]*?\n\s*\],/)?.[0] ?? "";
    expect(cadastros).not.toContain('label: "Tipos de Tarefa"');
    expect(home).not.toContain('titulo: "PREVENTIVO"');
    expect(home).not.toContain('label: "Cronograma"');
    expect(home).not.toContain('label: "Preventivas"');
    expect(home).toContain('pcmView === "tipos-tarefa" ?');
    expect(home).toContain('pcmView === "pmoc" ?');
  });

  it("liga a aba Área do Cliente à central real do portal", () => {
    const home = fonte("./HomePage.tsx");

    expect(home).toContain('activeModulo === "area-cliente"');
    expect(home).toContain("<AreaClienteAdminPage");
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

    expect(dashboard.match(/aria-label=\{`Resumo do Chamado/g)).toHaveLength(2);
    expect(dashboard).toContain("Resumo do Chamado");
  });
});
