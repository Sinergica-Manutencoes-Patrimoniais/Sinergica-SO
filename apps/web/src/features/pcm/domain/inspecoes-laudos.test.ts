import { describe, expect, it } from "vitest";
import {
  classificarPontoSpda,
  consolidarTotaisInspecao,
  sugerirConclusaoSpda,
} from "./inspecoes-laudos";

describe("inspecoes-laudos", () => {
  it("consolida totais de inspeção por resultado", () => {
    expect(
      consolidarTotaisInspecao([
        { resultado: "conforme" },
        { resultado: "nao_conforme" },
        { resultado: "atencao" },
        { resultado: "nao_avaliado" },
      ]),
    ).toEqual({ total: 4, conformes: 1, naoConformes: 1, atencao: 1 });
  });

  it("classifica ponto SPDA pela resistência medida", () => {
    expect(classificarPontoSpda(null)).toBe("pendente");
    expect(classificarPontoSpda(8)).toBe("conforme");
    expect(classificarPontoSpda(16)).toBe("atencao");
    expect(classificarPontoSpda(24)).toBe("nao_conforme");
  });

  it("sugere conclusão pelo pior status dos pontos", () => {
    expect(sugerirConclusaoSpda([])).toContain("rascunho");
    expect(sugerirConclusaoSpda([{ statusConformidade: "nao_conforme" }])).toContain(
      "não conformidades",
    );
    expect(
      sugerirConclusaoSpda([{ statusConformidade: "conforme" }, { statusConformidade: "atencao" }]),
    ).toContain("pontos de atenção");
  });
});
