import { describe, expect, it } from "vitest";
import { PREFERENCIA_LOCALIZACAO_PADRAO, montarLocalizacaoAuvo } from "./localizacao-auvo";

describe("localizacao-auvo", () => {
  it("concatena Área + Local + Sublocal com o separador padrão", () => {
    expect(montarLocalizacaoAuvo("Torre A", ["1º andar", "Sala 001"])).toBe(
      "Torre A · 1º andar · Sala 001",
    );
  });

  it("sublocal ausente — concatena só Área + Local", () => {
    expect(montarLocalizacaoAuvo("Torre A", ["1º andar"])).toBe("Torre A · 1º andar");
  });

  it("sem nenhum local — só a Área", () => {
    expect(montarLocalizacaoAuvo("Torre A", [])).toBe("Torre A");
  });

  it("sem Área — string vazia (Área é sempre obrigatória no domínio real)", () => {
    expect(montarLocalizacaoAuvo(null, ["1º andar"])).toBe("");
    expect(montarLocalizacaoAuvo(undefined)).toBe("");
  });

  it("separador customizado", () => {
    expect(
      montarLocalizacaoAuvo("Torre A", ["1º andar", "Sala 001"], {
        separador: " / ",
        ordem: "area_primeiro",
      }),
    ).toBe("Torre A / 1º andar / Sala 001");
  });

  it("ordem invertida (área por último)", () => {
    expect(
      montarLocalizacaoAuvo("Torre A", ["1º andar", "Sala 001"], {
        separador: " · ",
        ordem: "area_por_ultimo",
      }),
    ).toBe("1º andar · Sala 001 · Torre A");
  });

  it("filtra sublocais vazios/em branco no meio da cadeia", () => {
    expect(montarLocalizacaoAuvo("Torre A", ["1º andar", "", "  ", "Sala 001"])).toBe(
      "Torre A · 1º andar · Sala 001",
    );
  });

  it("usa o padrão quando nenhuma preferência é passada", () => {
    expect(montarLocalizacaoAuvo("Torre A", ["1º andar"])).toBe(
      montarLocalizacaoAuvo("Torre A", ["1º andar"], PREFERENCIA_LOCALIZACAO_PADRAO),
    );
  });
});
