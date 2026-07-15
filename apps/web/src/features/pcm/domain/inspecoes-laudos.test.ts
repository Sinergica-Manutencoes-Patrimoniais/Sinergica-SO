import { describe, expect, it } from "vitest";
import {
  classificarPontoSpda,
  consolidarTotaisInspecao,
  sugerirConclusaoSpda,
  validarCabecalhoInspecao,
  validarChecklistTemplate,
  validarItemInspecao,
  validarTipoInspecao,
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

  const CABECALHO_BASE = {
    titulo: "Inspeção Predial — Julho",
    tipoInspecaoId: null,
    dataInspecao: "2026-07-14",
    horaInicio: null,
    horaFim: null,
    edificacao: null,
    endereco: null,
    inspetor: null,
    responsavelNoLocal: null,
    responsavelTecnico: null,
    escopo: null,
    normaTecnica: null,
    art: null,
    condicoes: null,
    observacoesGerais: null,
  };

  it("valida cabeçalho de inspeção (E01-S73) — normaliza campos vazios pra null", () => {
    expect(
      validarCabecalhoInspecao({ ...CABECALHO_BASE, edificacao: "  Bloco A  ", inspetor: "" }),
    ).toEqual({ ...CABECALHO_BASE, edificacao: "Bloco A", inspetor: null });
  });

  it("bloqueia cabeçalho sem título ou sem data", () => {
    expect(() => validarCabecalhoInspecao({ ...CABECALHO_BASE, titulo: "  " })).toThrow(
      "Título é obrigatório",
    );
    expect(() => validarCabecalhoInspecao({ ...CABECALHO_BASE, dataInspecao: "" })).toThrow(
      "Data da inspeção é obrigatória",
    );
  });

  it("bloqueia hora de término antes da hora de início", () => {
    expect(() =>
      validarCabecalhoInspecao({ ...CABECALHO_BASE, horaInicio: "14:00", horaFim: "09:00" }),
    ).toThrow("Hora de término não pode ser antes");
  });

  const ITEM_BASE = {
    sistema: "geral" as const,
    categoria: null,
    elemento: null,
    localizacao: null,
    identificacao: null,
    descricao: "Infiltração no teto",
    resultado: "nao_conforme" as const,
    grauRisco: null,
    estadoConservacao: null,
    anomalia: null,
    recomendacao: null,
    prazoRecomendado: null,
    responsavelAcao: null,
    observacoes: null,
  };

  it("valida item de inspeção (E01-S73) — normaliza campos vazios pra null", () => {
    expect(validarItemInspecao({ ...ITEM_BASE, categoria: "  Cobertura  " })).toEqual({
      ...ITEM_BASE,
      categoria: "Cobertura",
    });
  });

  it("bloqueia item sem descrição", () => {
    expect(() => validarItemInspecao({ ...ITEM_BASE, descricao: "  " })).toThrow(
      "Descrição do item é obrigatória",
    );
  });

  it("valida tipo de inspeção", () => {
    expect(validarTipoInspecao({ nome: "  Elétrica  " })).toEqual({
      nome: "Elétrica",
      normaTecnica: null,
      descricao: null,
    });
    expect(() => validarTipoInspecao({ nome: "" })).toThrow("Nome do tipo de inspeção");
  });

  it("valida checklist template — exige tipo e ao menos 1 item", () => {
    expect(() =>
      validarChecklistTemplate({ tipoInspecaoId: "", nome: "Padrão", itens: [] }),
    ).toThrow("Tipo de inspeção é obrigatório");
    expect(() =>
      validarChecklistTemplate({ tipoInspecaoId: "t1", nome: "Padrão", itens: [] }),
    ).toThrow("pelo menos 1 item");
    expect(
      validarChecklistTemplate({
        tipoInspecaoId: "t1",
        nome: "Padrão",
        itens: [
          { categoria: "Estrutural", sistema: "estrutural", elemento: "Viga", obrigatorio: true },
        ],
      }).itens,
    ).toHaveLength(1);
  });
});
