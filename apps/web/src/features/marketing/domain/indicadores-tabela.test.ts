import { describe, expect, it } from "vitest";
import { type LinhaDeAnuncio, arvoreDoRelatorio, linhasVisiveis } from "./indicadores";

function linha(parcial: Partial<LinhaDeAnuncio> & { anuncioId: string }): LinhaDeAnuncio {
  return {
    campanhaId: "camp-1",
    campanhaNome: "Campanha A",
    campanhaSituacao: "ACTIVE",
    conjuntoId: "conj-1",
    conjuntoNome: "Conjunto A",
    anuncioNome: `Anúncio ${parcial.anuncioId}`,
    anuncioSituacao: "ACTIVE",
    temNumeros: true,
    gastoCentavos: 0,
    alcance: 0,
    impressoes: 0,
    cliques: 0,
    leads: 0,
    ...parcial,
  };
}

const relatorio = arvoreDoRelatorio([
  linha({ anuncioId: "a1", gastoCentavos: 30_000, impressoes: 6000, leads: 6 }),
  linha({
    anuncioId: "a2",
    conjuntoId: "conj-2",
    conjuntoNome: "Conjunto B",
    gastoCentavos: 20_000,
    impressoes: 4000,
    leads: 2,
  }),
]);

describe("linhasVisiveis — achatamento da árvore para a tabela (E06-S01)", () => {
  it("tudo fechado, mostra só as campanhas", () => {
    const linhas = linhasVisiveis(relatorio, new Set<string>());
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.nivel).toBe(0);
    expect(linhas[0]?.temFilhos).toBe(true);
  });

  it("AC-2: abrir a campanha revela os conjuntos, não os anúncios", () => {
    const linhas = linhasVisiveis(relatorio, new Set<string>(["camp-1"]));
    expect(linhas.map((l) => l.nivel)).toEqual([0, 1, 1]);
  });

  it("AC-3: abrir o conjunto revela os anúncios dele, e só dele", () => {
    const linhas = linhasVisiveis(relatorio, new Set<string>(["camp-1", "conj-1"]));
    expect(linhas.map((l) => l.nivel)).toEqual([0, 1, 2, 1]);
    expect(linhas[2]?.nome).toBe("Anúncio a1");
  });

  it("abrir um conjunto sem abrir a campanha não vaza anúncio para a tabela", () => {
    const linhas = linhasVisiveis(relatorio, new Set<string>(["conj-1"]));
    expect(linhas.map((l) => l.nivel)).toEqual([0]);
  });

  it("a chave distingue o nível, não só o id", () => {
    const linhas = linhasVisiveis(relatorio, new Set<string>(["camp-1"]));
    expect(new Set(linhas.map((l) => l.chave)).size).toBe(linhas.length);
    expect(linhas[0]?.chave.startsWith("campanha:")).toBe(true);
  });
});
