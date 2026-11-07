import { expect, it } from "vitest";
import { lerCronogramaPlano } from "./leitura-plano";

it("lê colunas explicitamente sem confundir minutos do I Home com horas Rimini", () => {
  const cabecalho = [
    "CONDOMÍNIO",
    "NATUREZA",
    "ÁREA",
    "ANDAR",
    "LOCAL",
    "SISTEMA",
    "TIPO DE EQUIPAMENTO",
    "EQUIPAMENTO",
    "IDENTIFICAÇÃO",
    "PERIODICIDADE",
    "RESPONSÁVEL",
    "TEMPO MÉDIO / OS (MIN)",
    "QTD. TÉCNICOS",
    "DURAÇÃO / OCORR. (H)",
    "HH / OCORRÊNCIA",
    "OCORRÊNCIAS",
    "HH TOTAL",
    "SITUAÇÃO",
    "S01",
  ];
  const dados = {
    CRONOGRAMA: [
      [],
      [],
      cabecalho,
      Array(18).fill("").concat(["2026-08-05"]),
      [
        "Cliente",
        "Equipamento",
        "Área",
        "Andar",
        "Local",
        "Hidráulico",
        "Bomba",
        "Bomba 1",
        "COD-01",
        "Trimestral",
        "Sinérgica",
        30,
        1,
        "",
        "",
        "",
        "",
        "",
        "X",
      ],
    ],
  };
  const resultado = lerCronogramaPlano(dados);
  expect(resultado.linhas).toHaveLength(1);
  expect(resultado.linhas[0]).toMatchObject({
    numeroLinha: 5,
    codigoOriginal: "COD-01",
    disciplina: "Hidráulico",
    duracao: { valor: 30, unidade: "minutos" },
    semanas: [{ codigo: "S01", data: "2026-08-05", marcador: "X" }],
  });
});

it("rejeita planilha sem cabeçalhos esperados, sem inferir linhas", () => {
  expect(() => lerCronogramaPlano({ CRONOGRAMA: [[], [], ["CONDOMÍNIO"]] })).toThrow();
});

it("lê datas brasileiras completas do CSV sem trocar dia e mês e rejeita datas impossíveis", () => {
  const cabecalho = ["CONDOMÍNIO", "NATUREZA", "ÁREA", "ANDAR", "LOCAL", "SISTEMA", "TIPO DE EQUIPAMENTO", "EQUIPAMENTO", "IDENTIFICAÇÃO", "PERIODICIDADE", "RESPONSÁVEL", "TEMPO MÉDIO / OS (MIN)", "QTD. TÉCNICOS", "DURAÇÃO / OCORR. (H)", "HH / OCORRÊNCIA", "OCORRÊNCIAS", "HH TOTAL", "SITUAÇÃO", "S01"];
  const matriz = (data: string) => ({ CRONOGRAMA: [[], [], cabecalho, Array(18).fill("").concat([data]), ["Cliente"]] });
  expect(lerCronogramaPlano(matriz("05/08/2026")).linhas[0]?.semanas[0]?.data).toBe("2026-08-05");
  expect(lerCronogramaPlano(matriz("29/02/2024")).linhas[0]?.semanas[0]?.data).toBe("2024-02-29");
  for (const invalida of ["29/02/2026", "31/04/2026", "08/13/2026", "5/8/26"]) {
    expect(() => lerCronogramaPlano(matriz(invalida))).toThrow("Semanas ou datas do cronograma inválidas.");
  }
});

it("preserva para conferência linha que contém apenas situação, sem descartá-la como vazia", () => {
  const cabecalho = [
    "CONDOMÍNIO",
    "NATUREZA",
    "ÁREA",
    "ANDAR",
    "LOCAL",
    "SISTEMA",
    "TIPO DE EQUIPAMENTO",
    "EQUIPAMENTO",
    "IDENTIFICAÇÃO",
    "PERIODICIDADE",
    "RESPONSÁVEL",
    "TEMPO MÉDIO / OS (MIN)",
    "QTD. TÉCNICOS",
    "DURAÇÃO / OCORR. (H)",
    "HH / OCORRÊNCIA",
    "OCORRÊNCIAS",
    "HH TOTAL",
    "SITUAÇÃO",
    "S01",
  ];
  const linha = Array(19).fill("");
  linha[17] = "Retirado";
  const resultado = lerCronogramaPlano({
    CRONOGRAMA: [[], [], cabecalho, Array(18).fill("").concat(["2026-08-05"]), linha],
  });
  expect(resultado.linhas).toHaveLength(1);
  expect(resultado.linhas[0]).toMatchObject({ numeroLinha: 5, valoresOriginais: linha });
});
