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
    // E01-S190: a árvore de navegação do PCM saiu de HomePage.tsx (era um array `PCM_NAV`
    // literal ali) para `navegacao-sso.ts`, puro e testável sem regex sobre texto-fonte — este
    // teste passa a checar lá os dados, e em HomePage.tsx só o que continua lá de verdade (o
    // switch de `pcmView`, inalterado por esta story).
    const nav = fonte("./navegacao-sso.ts");
    const home = fonte("./HomePage.tsx");

    // PMOC saiu do grupo OPERAÇÃO (decisão desta story — resposta 26 do Fabrício, PMOC é
    // modalidade do Plano de Manutenção, não item de operação diária) e vive agora em PLANOS.
    // Escopado ao objeto do item (entre `id: "pmoc"` e o `},` que fecha), não ao arquivo inteiro —
    // o cabeçalho do módulo menciona "OPERAÇÃO" e "pmoc" em prosa, perto o bastante pra um regex
    // sem escopo casar ali em vez de na entrada de dado de verdade.
    const entradaPmoc = nav.match(/\{\s*id: "pmoc"[\s\S]*?\n\s*\},/)?.[0] ?? "";
    expect(entradaPmoc).toContain('grupo: "PLANOS"');
    expect(entradaPmoc).not.toContain('grupo: "OPERAÇÃO"');
    // "Tipos de Tarefa" saiu de CONFIGURAÇÕES (nome antigo) e vive em CATÁLOGOS, nível
    // administração — mesma ideia de "catálogo administrativo", nome e nível atualizados.
    expect(nav).toMatch(/grupo: "CATÁLOGOS",[\s\S]{0,1800}view: "tipos-tarefa"/);
    const catalogos = nav.match(/id: "tipos-tarefa"[\s\S]*?\n\s*\},/)?.[0] ?? "";
    expect(catalogos).toContain('nivel: "administracao"');
    expect(nav).not.toContain('titulo: "PREVENTIVO"');
    expect(nav).not.toContain('grupo: "CADASTROS"'); // o grupo inteiro foi absorvido, não só esvaziado
    expect(nav).not.toContain('label: "Cronograma"');
    expect(nav).toContain('label: "Preventivas"');
    expect(home).toContain('pcmView === "tipos-tarefa" ?');
    expect(home).toContain('pcmView === "pmoc" ?');
    expect(home).toContain('pcmView === "preventivas" ?');
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

describe("E01-S190 — guarda de rota administrativa", () => {
  it("o conteúdo principal nega acesso às views administrativas por permissão, não só oculta o botão da sidebar (AC-5/AC-6)", () => {
    const home = fonte("./HomePage.tsx");

    // A guarda existe ANTES da árvore de ternários que decide qual página renderizar — defesa em
    // profundidade: mesmo que `pcmView` chegasse numa view administrativa por outro caminho que
    // não o clique do item (hoje não existe nenhum, mas a guarda não depende disso continuar
    // verdade), o conteúdo nega, não só a sidebar deixa de mostrar o botão.
    expect(home).toContain("VIEWS_ADMINISTRATIVAS.has(pcmView) && !podeGerenciarConfig");
    expect(home).toContain("Esta área é administrativa");
    // A lista de views guardadas vem do mesmo módulo que decide o que a sidebar mostra — nunca
    // uma segunda lista hardcoded que poderia divergir da primeira.
    expect(home).toContain('entradasPorNivel("administracao")');
  });
});
