import { expect, it } from "vitest";
import { lerMatrizCronogramaCsv } from "./matriz-cronograma-csv";
import { preverImportacaoPlano } from "./prever-importacao-plano";

it("confere duração do CSV sem perder o texto original nem interpretar números ambíguos", () => {
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
  ].join(";");
  const linha = (tempo: string) =>
    [
      "Cliente",
      "Equipamento",
      "Área",
      "Andar",
      "Local",
      "SPCI",
      "Bomba",
      "Bomba",
      "001",
      "Mensal",
      "Sinérgica",
      tempo,
      "1",
      "",
      "",
      "",
      "",
      "",
      "X",
    ].join(";");
  const csv = [
    "",
    "",
    cabecalho,
    `${";".repeat(18)}2026-08-05`,
    linha("30"),
    linha("0"),
    linha("1,000"),
    linha("30,5"),
    linha(""),
    linha("-1"),
  ].join("\n");
  const resultado = preverImportacaoPlano(
    { CRONOGRAMA: lerMatrizCronogramaCsv(csv) },
    "fonte",
    "cliente",
    [],
    {},
  );
  expect(resultado[0]?.conferencia.tempo).toEqual({ estado: "informado", horas: 0.5 });
  expect(resultado[0]?.original.duracao.valor).toBe("30");
  expect(resultado[1]?.conferencia.tempo).toEqual({ estado: "tempo_a_validar", horas: null });
  expect(resultado[2]?.conferencia.erros).toContain("tempo_invalido");
  expect(resultado[3]?.conferencia.tempo).toEqual({ estado: "informado", horas: 30.5 / 60 });
  expect(resultado[4]?.conferencia.tempo).toEqual({ estado: "tempo_a_validar", horas: null });
  expect(resultado[5]?.conferencia.erros).toContain("tempo_invalido");
});

it("preserva a data brasileira no CSV e exibe a data normalizada na conferência", () => {
  const cabecalho = ["CONDOMÍNIO", "NATUREZA", "ÁREA", "ANDAR", "LOCAL", "SISTEMA", "TIPO DE EQUIPAMENTO", "EQUIPAMENTO", "IDENTIFICAÇÃO", "PERIODICIDADE", "RESPONSÁVEL", "TEMPO MÉDIO / OS (MIN)", "QTD. TÉCNICOS", "DURAÇÃO / OCORR. (H)", "HH / OCORRÊNCIA", "OCORRÊNCIAS", "HH TOTAL", "SITUAÇÃO", "S01"];
  const csv = ["", "", cabecalho.join(";"), `${";".repeat(18)}05/08/2026`, `Cliente${";".repeat(17)};X`].join("\n");
  const matriz = lerMatrizCronogramaCsv(csv);
  const linhas = preverImportacaoPlano({ CRONOGRAMA: matriz }, "fonte", "cliente", [], {});
  expect(matriz[3]?.[18]).toBe("05/08/2026");
  expect(linhas[0]?.conferencia.semanas[0]).toMatchObject({ codigo: "S01", data: "2026-08-05", estado: "programado" });
});

it("exige escolha explícita de alvo e periodicidade antes de conferir", () => {
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
  const abas = {
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
  const alvos = [{ id: "alvo", clienteId: "cliente", tipo: "componente" as const }];
  const pendente = preverImportacaoPlano(abas, "fonte", "cliente", alvos, {});
  expect(pendente[0]?.conferencia.erros).toEqual([
    "alvo_nao_encontrado",
    "periodicidade_nao_confirmada",
  ]);
  const escolhido = preverImportacaoPlano(abas, "fonte", "cliente", alvos, {
    5: { alvoId: "alvo", periodicidadeExplicita: true },
  });
  expect(escolhido[0]?.conferencia.erros).toContain("periodicidade_nao_confirmada");
  const mapeado = preverImportacaoPlano(abas, "fonte", "cliente", alvos, {
    5: {
      alvoId: "alvo",
      recorrencia: { modo: "calendario", intervalo: 3, unidade: "meses", dataBase: "2026-08-05" },
    },
  });
  expect(mapeado[0]?.conferencia).toMatchObject({
    alvo: alvos[0],
    tempo: { estado: "informado", horas: 0.5 },
    recorrencia: { modo: "calendario", intervalo: 3, unidade: "meses", dataBase: "2026-08-05" },
    erros: [],
  });
  expect(mapeado[0]?.original.duracao).toEqual({ valor: 30, unidade: "minutos" });
});
