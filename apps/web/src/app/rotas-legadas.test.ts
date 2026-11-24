import { describe, expect, it } from "vitest";
import { NAVEGACAO_SSO, PCM_NAV } from "./navegacao-sso";
import {
  ROTAS_LEGADAS,
  VIEWS_LEGADAS,
  resolverRotaLegada,
  rotaInicialDaUrl,
  viewsAlcancaveis,
} from "./rotas-legadas";

describe("E01-S190 task 5 — rotas legadas (AC-3 / SC-003)", () => {
  // Teste de TABELA: varre a lista inteira, não uma amostra. É o que transforma "achamos que
  // nada quebrou" em "nenhuma rota antiga morre sem alguém escrever para onde ela foi".
  it.each(VIEWS_LEGADAS)("a rota antiga %s resolve para um destino alcançável", (view) => {
    const destino = resolverRotaLegada(view);
    expect(destino).not.toBeNull();
    expect(viewsAlcancaveis().has(destino as never)).toBe(true);
  });

  it("toda view que hoje é item de menu está declarada como rota legada", () => {
    const doMenu = PCM_NAV.flatMap((g) => g.items).flatMap((i) => (i.view ? [i.view] : []));
    const declaradas = new Set(VIEWS_LEGADAS);
    expect(doMenu.filter((view) => !declaradas.has(view))).toEqual([]);
  });

  it("toda view da árvore nova está declarada como rota legada", () => {
    const daArvore = NAVEGACAO_SSO.flatMap((e) => (e.view ? [e.view] : []));
    const declaradas = new Set(VIEWS_LEGADAS);
    expect(daArvore.filter((view) => !declaradas.has(view))).toEqual([]);
  });

  it("o mapa não tem destino órfão — todo destino é, ele próprio, uma view conhecida", () => {
    const conhecidas = new Set(VIEWS_LEGADAS);
    expect(Object.values(ROTAS_LEGADAS).filter((destino) => !conhecidas.has(destino))).toEqual([]);
  });

  it("identificador desconhecido devolve null — nunca undefined, nunca exceção", () => {
    expect(resolverRotaLegada("tela-que-nunca-existiu")).toBeNull();
    expect(resolverRotaLegada("")).toBeNull();
    expect(resolverRotaLegada("__proto__")).toBeNull();
  });

  it("lê o deep-link ?view= da URL e resolve pelo mapa", () => {
    expect(rotaInicialDaUrl("?view=inspecoes")).toBe("inspecoes");
    // Task 9: o favorito antigo de Assessment cai em Inspeções, nunca numa tela vazia (AC-3).
    expect(rotaInicialDaUrl("?view=assessment")).toBe("inspecoes");
    expect(rotaInicialDaUrl("?outra=coisa")).toBeNull();
    expect(rotaInicialDaUrl("")).toBeNull();
    expect(rotaInicialDaUrl("?view=nao-existe")).toBeNull();
  });

  it("a rota de Assessment aponta para Inspeções, que é onde a classificação o colocou", () => {
    // Trava da task 9: esta é a linha que impede tirar Assessment do menu em silêncio. Se alguém
    // remover a entrada da árvore sem declarar o destino, `viewsAlcancaveis()` deixa de conter
    // `assessment` e o teste de tabela acima quebra antes do merge.
    expect(resolverRotaLegada("assessment")).toBe("inspecoes");
    expect(viewsAlcancaveis().has("inspecoes")).toBe(true);
  });

  it("backlog continua carregando a aba do board — mapear para 'ordens' perderia o deep-link", () => {
    expect(resolverRotaLegada("backlog")).toBe("backlog");
    const chamados = NAVEGACAO_SSO.find((e) => e.view === "ordens");
    expect(chamados?.absorveu).toContain("backlog");
    expect(chamados?.absorveu).toContain("chamados");
  });
});
