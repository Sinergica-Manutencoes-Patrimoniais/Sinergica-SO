import { describe, expect, it } from "vitest";
import type { EntradaNav, PcmView } from "./navegacao-sso";
import {
  NAVEGACAO_SSO,
  PCM_NAV,
  VIEWS_CONSOLIDADAS,
  bloqueioDeAdministracao,
  navegacaoAgrupada,
  navegacaoVisivel,
  pcmNavConsolidado,
} from "./navegacao-sso";

const SEM_CAPACIDADES: ReadonlySet<string> = new Set<string>();
const tudoLiberado = () => true;
const soLeitura = (_modulo: string, nivel: "leitura" | "escrita") => nivel === "leitura";
const nada = () => false;

describe("E01-S190 task 2 — extração sem troca de rótulo", () => {
  // Este teste existe para travar a task 2: a árvore saiu de `HomePage.tsx` e veio para cá
  // VERBATIM. Se alguém renomear um item achando que "é só um rótulo", o inventário antes/depois
  // muda e o AC-7 (nenhuma ação sumiu sem decisão registrada) é violado em silêncio.
  it("preserva os grupos e os rótulos do menu publicado do PCM", () => {
    expect(PCM_NAV.map((g) => g.titulo)).toEqual([
      "OPERAÇÃO",
      "CADASTROS",
      "CONFIGURAÇÕES",
      "RELATÓRIOS",
    ]);
    expect(PCM_NAV.flatMap((g) => g.items.map((i) => i.label))).toEqual([
      "Dashboard",
      "Chamados",
      "Inspeções",
      "Assessment",
      "Ferramentas por Técnico",
      "Agenda do Técnico",
      "PMOC",
      "Preventivas",
      // E01-S201: entrada NOVA, não renomeação. O guard abaixo existe para pegar rótulo trocado
      // ou item removido em silêncio — feature nova pode crescer a lista, desde que a adição
      // seja explícita aqui.
      "Monitor Auvo (T−24)",
      "Relatório",
      "Clientes",
      "Componentes",
      "Sistemas",
      "Ferramentas",
      "Equipes",
      "Funcionários",
      "Tipos de Tarefa",
      "Grupos de Clientes",
      "Marcações de Cliente",
      "Tipos de Inspeção",
      "Categorias Equip.",
      "Segmentos",
      "Grupos de Usuário",
      "Palavras-chave",
      "Relatório do Dia",
      "Relatório do Cliente",
      "Laudo SPDA",
      "Apontamento de Horas",
    ]);
  });
});

describe("E01-S190 task 3 — navegacaoVisivel (AC-6)", () => {
  it("devolve tudo quando a permissão libera tudo", () => {
    expect(navegacaoVisivel(NAVEGACAO_SSO, tudoLiberado, SEM_CAPACIDADES)).toHaveLength(
      NAVEGACAO_SSO.length,
    );
  });

  it("esconde a Administração de quem só tem leitura, e mantém o resto", () => {
    const visiveis = navegacaoVisivel(NAVEGACAO_SSO, soLeitura, SEM_CAPACIDADES);
    expect(visiveis.some((e) => e.nivel === "administracao")).toBe(false);
    expect(visiveis.some((e) => e.nivel === "trabalho")).toBe(true);
    expect(visiveis.some((e) => e.nivel === "gestao")).toBe(true);
  });

  it("esconde tudo de quem não tem permissão no módulo", () => {
    expect(navegacaoVisivel(NAVEGACAO_SSO, nada, SEM_CAPACIDADES)).toHaveLength(0);
  });

  it("não decide por papel: mesma permissão, mesmo menu — o papel nem é parâmetro", () => {
    // A assinatura da função não tem papel. Este teste prova a consequência prática: dois
    // usuários com a MESMA resolução de permissão enxergam exatamente o mesmo menu, qualquer que
    // seja o cargo deles. Ocultar é consequência da permissão, nunca lista fixa por papel.
    const supervisor = navegacaoVisivel(NAVEGACAO_SSO, soLeitura, SEM_CAPACIDADES);
    const colaborador = navegacaoVisivel(NAVEGACAO_SSO, soLeitura, SEM_CAPACIDADES);
    expect(supervisor.map((e) => e.id)).toEqual(colaborador.map((e) => e.id));
  });

  it("respeita capacidade declarada, quando houver", () => {
    const entrada: EntradaNav = {
      id: "teste.sensivel",
      label: "Ação sensível",
      nivel: "administracao",
      grupo: "CATÁLOGOS",
      modulo: "pcm",
      view: "tipos-tarefa",
      icone: NAVEGACAO_SSO[0]?.icone ?? (() => null),
      capacidade: "cadastro.gerir",
    } as EntradaNav;
    expect(navegacaoVisivel([entrada], tudoLiberado, SEM_CAPACIDADES)).toHaveLength(0);
    expect(navegacaoVisivel([entrada], tudoLiberado, new Set(["cadastro.gerir"]))).toHaveLength(1);
  });

  it("agrupa por nível na ordem Trabalho · Gestão · Administração", () => {
    const blocos = navegacaoAgrupada(
      navegacaoVisivel(NAVEGACAO_SSO, tudoLiberado, SEM_CAPACIDADES),
    );
    expect(blocos.map((b) => b.nivel)).toEqual(["trabalho", "gestao", "administracao"]);
    expect(blocos[0]?.grupos.map((g) => g.grupo)).toEqual([
      "ROTINA",
      "PLANEJAMENTO E VISITAS",
      "CLIENTES E ESTRUTURA",
      "RELATÓRIOS",
    ]);
  });

  it("não devolve bloco de nível vazio", () => {
    const blocos = navegacaoAgrupada(navegacaoVisivel(NAVEGACAO_SSO, soLeitura, SEM_CAPACIDADES));
    expect(blocos.map((b) => b.nivel)).not.toContain("administracao");
  });
});

describe("E01-S190 task 13 — guarda de rota da Administração (AC-5/AC-6)", () => {
  it("bloqueia a view administrativa de quem só tem leitura", () => {
    const bloqueio = bloqueioDeAdministracao("tipos-tarefa", soLeitura, SEM_CAPACIDADES);
    expect(bloqueio?.label).toBe("Tipos de Tarefa");
  });

  it("libera a view administrativa de quem tem escrita", () => {
    expect(bloqueioDeAdministracao("tipos-tarefa", tudoLiberado, SEM_CAPACIDADES)).toBeNull();
  });

  it("não bloqueia view de trabalho — a guarda é da Administração, não do sistema inteiro", () => {
    for (const view of ["dashboard", "ordens", "inspecoes", "clientes"] as PcmView[]) {
      expect(bloqueioDeAdministracao(view, soLeitura, SEM_CAPACIDADES)).toBeNull();
    }
  });

  it("cobre TODA view administrativa da árvore, não só as que alguém lembrou de testar", () => {
    const administrativas = NAVEGACAO_SSO.filter((e) => e.nivel === "administracao" && e.view);
    expect(administrativas.length).toBeGreaterThan(0);
    for (const entrada of administrativas) {
      expect(
        bloqueioDeAdministracao(entrada.view as PcmView, soLeitura, SEM_CAPACIDADES),
      ).not.toBeNull();
    }
  });
});

describe("E01-S190 task 4 — reorganização não perde alcance (AC-7)", () => {
  it("toda view do menu publicado continua alcançável na árvore nova", () => {
    const alcancaveis = new Set<string>();
    for (const entrada of NAVEGACAO_SSO) {
      if (entrada.view) alcancaveis.add(entrada.view);
      for (const absorvida of entrada.absorveu ?? []) alcancaveis.add(absorvida);
    }
    const publicadas = PCM_NAV.flatMap((g) => g.items).flatMap((i) => (i.view ? [i.view] : []));
    expect(publicadas.filter((view) => !alcancaveis.has(view))).toEqual([]);
  });

  it("o atalho de Grupos de Usuário sobrevive à reorganização", () => {
    expect(NAVEGACAO_SSO.some((e) => e.atalhoConfigGrupos)).toBe(true);
  });

  it("nenhum id de entrada se repete", () => {
    const ids = NAVEGACAO_SSO.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("E01-S190 task 9 — Assessment deixa de ser módulo (ADR-1697)", () => {
  it("Assessment não é mais entrada própria na árvore nova", () => {
    expect(NAVEGACAO_SSO.some((e) => e.view === "assessment")).toBe(false);
    expect(NAVEGACAO_SSO.some((e) => e.id === "trabalho.assessment")).toBe(false);
  });

  it("Inspeções declara que absorveu Assessment — é o que mantém a rota viva", () => {
    const inspecoes = NAVEGACAO_SSO.find((e) => e.view === "inspecoes");
    expect(inspecoes?.absorveu).toContain("assessment");
  });

  it("PMOC CONTINUA no menu, e isso é decisão registrada, não esquecimento", () => {
    // Os Contratos PMOC de produção (`pcm.pmoc_contracts`) não são Planos de Manutenção: não há
    // FK entre eles. A migration 1869 criou a modalidade e a visão filtrada, mas converter o
    // contrato existente em Plano seria CRIAR registro — pergunta de produto aberta na ADR-1697
    // §3. Enquanto isso, tirar PMOC do menu deixaria imóveis, ARTs e laudos sem porta de entrada.
    expect(NAVEGACAO_SSO.some((e) => e.view === "pmoc")).toBe(true);
    expect(VIEWS_CONSOLIDADAS).not.toContain("pmoc");
  });

  it("a árvore vigente só perde Assessment quando a flag de consolidação está ligada", () => {
    // `PCM_NAV` é o menu publicado. O literal continua verbatim (o teste da task 2 prova isso);
    // a remoção é derivada, porque mudar o menu publicado sem flag quebraria a promessa da story.
    const vigentes = PCM_NAV.flatMap((g) => g.items).flatMap((i) => (i.view ? [i.view] : []));
    expect(vigentes).toContain("assessment");

    const consolidado = pcmNavConsolidado();
    const depois = consolidado.flatMap((g) => g.items).flatMap((i) => (i.view ? [i.view] : []));
    expect(depois).not.toContain("assessment");
    expect(depois).toContain("pmoc");
    // Exatamente uma entrada a menos: a consolidação não pode levar nada junto por tabela.
    expect(vigentes.length - depois.length).toBe(1);
  });

  it("a consolidação não deixa grupo vazio nem mexe nos títulos dos que restam", () => {
    const consolidado = pcmNavConsolidado();
    expect(consolidado.every((g) => g.items.length > 0)).toBe(true);
    expect(consolidado.map((g) => g.titulo)).toEqual(PCM_NAV.map((g) => g.titulo));
  });

  it("toda view consolidada continua alcançável por alguma entrada da árvore nova", () => {
    const alcancaveis = new Set<string>();
    for (const entrada of NAVEGACAO_SSO) {
      if (entrada.view) alcancaveis.add(entrada.view);
      for (const absorvida of entrada.absorveu ?? []) alcancaveis.add(absorvida);
    }
    for (const view of VIEWS_CONSOLIDADAS) expect(alcancaveis.has(view)).toBe(true);
  });
});
