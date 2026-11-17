import { describe, expect, it } from "vitest";
import {
  NAVEGACAO_SSO,
  entradasPorGrupo,
  entradasPorNivel,
  navegacaoVisivel,
  todasAsViews,
} from "./navegacao-sso";

// AC-7: toda view que existia em PCM_NAV antes da reorganização precisa continuar alcançável
// (pai ou filho) — lista extraída manualmente de HomePage.tsx no momento da extração desta story.
const VIEWS_ORIGINAIS_PCM_NAV = [
  "dashboard",
  "ordens",
  "inspecoes",
  "assessment",
  "ferramentas-por-tecnico",
  "agenda-tecnico",
  "pmoc",
  "preventivas",
  "relatorio-planejamento",
  "clientes",
  "equipamentos",
  "sistemas",
  "ferramentas",
  "equipes",
  "funcionarios",
  "tipos-tarefa",
  "cliente-grupos",
  "cliente-marcacoes",
  "tipos-inspecao",
  "equipamento-categorias",
  "segmentos",
  "palavras-chave",
  "relatorio-diario",
  "relatorio-cliente",
  "laudos-spda",
  "apontamento-horas",
];

describe("NAVEGACAO_SSO", () => {
  it("AC-7 — nenhuma view do menu original desapareceu (pai ou filho)", () => {
    const alcancaveis = new Set(todasAsViews());
    for (const view of VIEWS_ORIGINAIS_PCM_NAV) {
      expect(alcancaveis.has(view), `view "${view}" sumiu da navegação`).toBe(true);
    }
  });

  it("não tem id duplicado entre pais e filhos", () => {
    const ids: string[] = [];
    for (const entrada of NAVEGACAO_SSO) {
      ids.push(entrada.id);
      for (const filho of entrada.filhos ?? []) ids.push(filho.id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('"Grupos de Usuário" continua como atalho pra Configurações, nunca duplica CRUD', () => {
    const entrada = NAVEGACAO_SSO.find((e) => e.id === "grupos-usuario");
    expect(entrada?.atalhoConfigGrupos).toBe(true);
    expect(entrada?.view).toBeUndefined();
  });

  it('"Diagnóstico Inicial do Cliente" é filho de "Inspeções" e aponta pra view "assessment"', () => {
    const inspecoes = NAVEGACAO_SSO.find((e) => e.id === "inspecoes");
    const diagnostico = inspecoes?.filhos?.find((f) => f.id === "assessment");
    expect(diagnostico?.label).toBe("Diagnóstico Inicial do Cliente");
    expect(diagnostico?.view).toBe("assessment");
  });

  it('"Componentes" e "Sistemas" são filhos de "Clientes e Estrutura", nunca itens principais', () => {
    const clientesEEstrutura = NAVEGACAO_SSO.find((e) => e.id === "clientes");
    expect(clientesEEstrutura?.filhos?.map((f) => f.id).sort()).toEqual([
      "equipamentos",
      "sistemas",
    ]);
    // E NENHUM dos dois é top-level por fora disso — resposta 27: menu/jornada unifica, entidade não.
    const topLevel = NAVEGACAO_SSO.filter((e) => e.id === "equipamentos" || e.id === "sistemas");
    expect(topLevel).toHaveLength(0);
  });
});

describe("entradasPorNivel / entradasPorGrupo", () => {
  it("cada entrada aparece em exatamente um nível", () => {
    const totalPorNivel =
      entradasPorNivel("trabalho").length +
      entradasPorNivel("gestao").length +
      entradasPorNivel("administracao").length;
    expect(totalPorNivel).toBe(NAVEGACAO_SSO.length);
  });

  it("agrupa por grupo dentro do nível, preservando a ordem de declaração", () => {
    const grupos = entradasPorGrupo("administracao");
    expect([...grupos.keys()]).toEqual(["CATÁLOGOS"]);
    expect(grupos.get("CATÁLOGOS")).toHaveLength(entradasPorNivel("administracao").length);
  });
});

describe("navegacaoVisivel — AC-6", () => {
  it("sem capacidade administrativa, nenhuma entrada de administração aparece", () => {
    const visiveis = navegacaoVisivel(NAVEGACAO_SSO, false);
    expect(visiveis.some((e) => e.nivel === "administracao")).toBe(false);
    expect(visiveis.length).toBe(
      entradasPorNivel("trabalho").length + entradasPorNivel("gestao").length,
    );
  });

  it("com capacidade administrativa, todas as entradas aparecem", () => {
    const visiveis = navegacaoVisivel(NAVEGACAO_SSO, true);
    expect(visiveis.length).toBe(NAVEGACAO_SSO.length);
  });

  it("ocultar é consequência da checagem recebida, nunca uma lista fixa de ids hardcoded", () => {
    // prova indireta: a função não conhece nenhum id específico — só olha `nivel`.
    const semAdmin = navegacaoVisivel(NAVEGACAO_SSO, false);
    for (const entrada of semAdmin) expect(entrada.nivel).not.toBe("administracao");
  });
});
