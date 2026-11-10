import { describe, expect, it } from "vitest";
import { consultarVigencia } from "./vigencia-plano";

const versoes = [
  {
    id: "antiga",
    estado: "aprovado" as const,
    vigenciaInicio: "2026-01-01",
    vigenciaFim: "2026-12-31",
  },
  { id: "futura", estado: "aprovado" as const, vigenciaInicio: "2027-01-01", vigenciaFim: null },
  { id: "rascunho", estado: "rascunho" as const, vigenciaInicio: null, vigenciaFim: null },
] as const;

describe("consulta de vigência por data explícita", () => {
  it("identifica a versão por data inclusiva sem assumir versão mais recente como vigente", () => {
    expect(consultarVigencia(versoes, "2026-12-31", true)).toEqual({
      tipo: "encontrada",
      versaoId: "antiga",
    });
    expect(consultarVigencia(versoes, "2027-01-01", true)).toEqual({
      tipo: "encontrada",
      versaoId: "futura",
    });
    expect(consultarVigencia(versoes, "2025-01-01", true)).toEqual({ tipo: "nenhuma" });
  });
  it("não afirma resultado com paginação incompleta", () => {
    expect(consultarVigencia(versoes, "2026-01-01", false)).toEqual({ tipo: "incompleta" });
  });
  it("detecta sobreposição sem escolher uma versão silenciosamente", () => {
    expect(
      consultarVigencia([...versoes, { ...versoes[0], id: "conflitante" }], "2026-06-01", true),
    ).toEqual({ tipo: "conflito" });
  });
  it("recusa data inválida e vigência histórica incompleta", () => {
    expect(consultarVigencia(versoes, "2026-02-30", true)).toEqual({ tipo: "data_invalida" });
    expect(
      consultarVigencia([{ ...versoes[0], vigenciaInicio: null }], "2026-02-01", true),
    ).toEqual({ tipo: "dados_invalidos" });
    expect(
      consultarVigencia([{ ...versoes[0], vigenciaFim: "2025-12-31" }], "2026-02-01", true),
    ).toEqual({ tipo: "dados_invalidos" });
  });
});
