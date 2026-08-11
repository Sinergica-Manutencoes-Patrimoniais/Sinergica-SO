import { describe, expect, it } from "vitest";
import { parsearPlanilhaLevantamento, prepararRevisaoImportacaoExcel } from "./inspecao-excel";

describe("parsearPlanilhaLevantamento", () => {
  it("lê linhas, monta preview bruto e preserva URLs de foto", () => {
    const resultado = parsearPlanilhaLevantamento([
      ["Local", "Fotos", "Relato"],
      [
        "Casa de máquinas",
        "https://exemplo.test/a.jpg; https://exemplo.test/b.jpg",
        "Vazamento na bomba",
      ],
    ]);
    expect(resultado.textoParaClassificacao).toContain("Vazamento na bomba");
    expect(resultado.itensBrutos).toEqual([
      expect.objectContaining({
        local: "Casa de máquinas",
        gravidade: 3,
        urgencia: 3,
        tendencia: 3,
        fotoUrls: ["https://exemplo.test/a.jpg", "https://exemplo.test/b.jpg"],
      }),
    ]);
  });

  it("E01-S144: coluna 'Ocorrência' do Auvo é foto, não relato", () => {
    const resultado = parsearPlanilhaLevantamento([
      ["Local", "Ocorrência", "Relato"],
      [
        "Hall 15 BL A",
        "https://auvo-producao.s3.amazonaws.com/anexos_tarefas/a.jpg;https://auvo-producao.s3.amazonaws.com/anexos_tarefas/b.jpg",
        "Cabos do sistema de alarme de incêndio expostos",
      ],
    ]);
    expect(resultado.itensBrutos).toEqual([
      expect.objectContaining({
        local: "Hall 15 BL A",
        relatoOriginal: "Cabos do sistema de alarme de incêndio expostos",
        fotoUrls: [
          "https://auvo-producao.s3.amazonaws.com/anexos_tarefas/a.jpg",
          "https://auvo-producao.s3.amazonaws.com/anexos_tarefas/b.jpg",
        ],
      }),
    ]);
  });

  it("explica a coluna ausente em vez de tentar índices silenciosos", () => {
    expect(() =>
      parsearPlanilhaLevantamento([
        ["Local", "Fotos"],
        ["Hall", ""],
      ]),
    ).toThrow("Planilha sem coluna de relato/descrição da ocorrência.");
  });

  it("rejeita planilha sem linhas preenchidas", () => {
    expect(() => parsearPlanilhaLevantamento([["Relato"], [""]])).toThrow(
      "Planilha não possui linhas de levantamento preenchidas.",
    );
  });

  it("faz fallback para o levantamento bruto quando a IA não retorna itens", () => {
    const bruto = parsearPlanilhaLevantamento([
      ["Local", "Relato"],
      ["Hall", "Luminária apagada"],
    ]).itensBrutos;
    const revisao = prepararRevisaoImportacaoExcel([], bruto);
    expect(revisao.itens).toEqual(bruto);
    expect(revisao.aviso).toContain("levantamento bruto");
  });
});
