import { describe, expect, it } from "vitest";
import {
  conferirLinhasPlano,
  interpretarMarcadorPlano,
  interpretarTempoSpci,
} from "./importacao-plano";

describe("conferência da fonte do Plano", () => {
  it("trata X como programação e nunca como execução", () => {
    expect(interpretarMarcadorPlano(" X ")).toEqual({ estado: "programado" });
    expect(interpretarMarcadorPlano("")).toEqual({ estado: "sem_marcacao" });
    expect(interpretarMarcadorPlano("concluído")).toEqual({
      estado: "desconhecido",
      original: "concluído",
    });
  });

  it("preserva tempo SPCI zero ou ausente como pendente, sem inventar horas", () => {
    expect(interpretarTempoSpci(0)).toEqual({ estado: "tempo_a_validar", horas: null });
    expect(interpretarTempoSpci(null)).toEqual({ estado: "tempo_a_validar", horas: null });
    expect(interpretarTempoSpci(2.5)).toEqual({ estado: "informado", horas: 2.5 });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("recusa tempo inválido %s", (horas) => {
    expect(() => interpretarTempoSpci(horas)).toThrow();
  });
});

describe("prévia sem gravação", () => {
  const alvos = [
    { id: "sistema-a", clienteId: "cliente-a", tipo: "sistema" as const },
    { id: "outro", clienteId: "cliente-b", tipo: "componente" as const },
  ] as const;
  const linha = {
    numeroLinha: 1,
    disciplina: "SPCI",
    alvoId: "sistema-a",
    horasSpci: 0,
    recorrencia: {
      modo: "calendario" as const,
      intervalo: 1,
      unidade: "meses" as const,
      dataBase: "2026-08-05",
    },
    semanas: [{ codigo: "S31", data: "2026-08-05", marcador: "X" }],
  };
  it("preserva linhas e identidade da fonte, sem confundir semana de arquivos distintos", () => {
    const rimini = conferirLinhasPlano(
      "rimini",
      "cliente-a",
      Array.from({ length: 59 }, (_, i) => ({ ...linha, numeroLinha: i + 1 })),
      alvos,
    );
    const home = conferirLinhasPlano(
      "i-home",
      "cliente-a",
      Array.from({ length: 53 }, (_, i) => ({
        ...linha,
        numeroLinha: i + 1,
        semanas: [{ codigo: "S01", data: "2026-08-05", marcador: "X" }],
      })),
      alvos,
    );
    expect(rimini).toHaveLength(59);
    expect(home).toHaveLength(53);
    expect(rimini[0]).toMatchObject({
      fonteId: "rimini",
      numeroLinha: 1,
      disciplina: "SPCI",
      alvo: alvos[0],
      tempo: { estado: "tempo_a_validar" },
      semanas: [{ codigo: "S31", data: "2026-08-05", estado: "programado" }],
      erros: [],
    });
    expect(home[0]).toMatchObject({
      fonteId: "i-home",
      semanas: [{ codigo: "S01", data: "2026-08-05", estado: "programado" }],
    });
    expect(JSON.stringify(rimini)).not.toContain("executado");
  });
  it("aponta vínculo ausente, outro Cliente, periodicidade sem decisão e marcador desconhecido", () => {
    const linhas = [
      { ...linha, numeroLinha: 2, alvoId: "inexistente" },
      { ...linha, numeroLinha: 3, alvoId: "outro" },
      { ...linha, numeroLinha: 4, recorrencia: undefined },
      { ...linha, numeroLinha: 5, semanas: [{ codigo: "S01", data: "2026-08-05", marcador: "?" }] },
    ];
    const resultado = conferirLinhasPlano("fonte", "cliente-a", linhas, alvos);
    expect(resultado.map((item) => item.erros)).toEqual([
      ["alvo_nao_encontrado"],
      ["alvo_nao_encontrado"],
      ["periodicidade_nao_confirmada"],
      ["marcador_desconhecido"],
    ]);
  });
  it("preserva valores da fonte mesmo quando inválidos", () => {
    const resultado = conferirLinhasPlano(
      "fonte",
      "cliente-a",
      [
        {
          ...linha,
          horasSpci: -1,
          semanas: [{ codigo: "S1", data: "2026-08-05", marcador: " X " }],
        },
      ],
      alvos,
    );
    expect(resultado[0]).toMatchObject({
      horasOriginais: -1,
      erros: ["tempo_invalido"],
      semanas: [{ marcadorOriginal: " X ", estado: "programado" }],
    });
  });
  it("recusa identidades de lote ausentes e marca linhas ou alvos ambíguos", () => {
    expect(() => conferirLinhasPlano("", "cliente-a", [linha], alvos)).toThrow();
    expect(() => conferirLinhasPlano("fonte", "", [linha], alvos)).toThrow();
    const resultado = conferirLinhasPlano(
      "fonte",
      "cliente-a",
      [linha, linha],
      [alvos[0], alvos[0]],
    );
    expect(resultado).toHaveLength(2);
    expect(resultado[0]?.erros).toContain("linha_duplicada");
    expect(resultado[0]?.erros).toContain("alvo_ambiguo");
  });
  it("não aceita alvo vazio ou categoria desconhecida como vínculo resolvido", () => {
    const resultado = conferirLinhasPlano(
      "fonte",
      "cliente-a",
      [
        { ...linha, alvoId: "" },
        { ...linha, numeroLinha: 2, alvoId: "invalido" },
      ],
      [
        { id: "", clienteId: "cliente-a", tipo: "sistema" },
        { id: "invalido", clienteId: "cliente-a", tipo: "inventado" as never },
      ],
    );
    expect(resultado.map((item) => item.erros)).toEqual([
      ["alvo_nao_encontrado"],
      ["alvo_invalido"],
    ]);
    expect(resultado.map((item) => item.alvo)).toEqual([undefined, undefined]);
  });
  it("exige recorrência válida e preserva a regra escolhida sem converter mês em quatro semanas", () => {
    const resultado = conferirLinhasPlano(
      "fonte",
      "cliente-a",
      [
        { ...linha, numeroLinha: 1 },
        { ...linha, numeroLinha: 2, recorrencia: { ...linha.recorrencia, intervalo: 0 } },
        { ...linha, numeroLinha: 3, recorrencia: { ...linha.recorrencia, dataBase: "2026-02-30" } },
        {
          ...linha,
          numeroLinha: 4,
          recorrencia: { modo: "visita", intervalo: 1, unidade: "semanas", dataBase: null },
        },
      ],
      alvos,
    );
    expect(resultado[0]).toMatchObject({
      erros: [],
      recorrencia: { modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-08-05" },
    });
    expect(resultado[1]).toMatchObject({
      erros: ["periodicidade_nao_confirmada"],
      recorrencia: null,
    });
    expect(resultado[2]).toMatchObject({
      erros: ["periodicidade_nao_confirmada"],
      recorrencia: null,
    });
    expect(resultado[3]).toMatchObject({
      erros: [],
      recorrencia: { modo: "visita", intervalo: 1, unidade: "semanas", dataBase: null },
    });
  });
});
