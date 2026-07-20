import { describe, expect, it } from "vitest";
import {
  type ApontamentoHorasItem,
  type DiaTecnico,
  agregarPorCliente,
  agregarPorSemana,
  agregarPorTecnico,
  agruparPorDia,
  calcularCusto,
  calcularHorasOs,
  filtrarApontamentos,
  formatarHorasMinutos,
  gerarCsvApontamento,
  sinalizarJornada,
} from "./apontamento-horas";

function item(overrides: Partial<ApontamentoHorasItem> = {}): ApontamentoHorasItem {
  return {
    osId: "os1",
    osNumero: "CH-001",
    clienteId: "c1",
    clienteNome: "Cliente A",
    tecnicoFuncionarioId: "t1",
    tecnicoNome: "Técnico A",
    dataAgendada: "2026-07-10T00:00:00Z",
    checkInAt: null,
    checkOutAt: null,
    horas: 2,
    ...overrides,
  };
}

describe("apontamento-horas", () => {
  it("usa duracaoHoras quando presente (prioridade 1)", () => {
    expect(calcularHorasOs(3.5, "2026-07-10T08:00:00Z", "2026-07-10T12:00:00Z")).toBe(3.5);
  });

  it("cai pro diff de check-in/check-out quando duracaoHoras ausente", () => {
    expect(calcularHorasOs(null, "2026-07-10T08:00:00Z", "2026-07-10T10:30:00Z")).toBe(2.5);
  });

  it("retorna 0 sem duracaoHoras nem check-in/out completo (nunca some, aparece com 0)", () => {
    expect(calcularHorasOs(null, null, null)).toBe(0);
    expect(calcularHorasOs(null, "2026-07-10T08:00:00Z", null)).toBe(0);
  });

  it("ignora check-out anterior ao check-in (dado inconsistente)", () => {
    expect(calcularHorasOs(null, "2026-07-10T12:00:00Z", "2026-07-10T08:00:00Z")).toBe(0);
  });

  it("filtra por técnico e cliente", () => {
    const itens = [
      item({ osId: "os1", tecnicoFuncionarioId: "t1", clienteId: "c1" }),
      item({ osId: "os2", tecnicoFuncionarioId: "t2", clienteId: "c1" }),
    ];
    expect(
      filtrarApontamentos(itens, { inicio: "", fim: "", tecnicoFuncionarioId: "t1" }).map(
        (i) => i.osId,
      ),
    ).toEqual(["os1"]);
    expect(filtrarApontamentos(itens, { inicio: "", fim: "", clienteId: "c1" })).toHaveLength(2);
  });

  it("agrega horas por cliente, ordenado do maior pro menor", () => {
    const itens = [
      item({ osId: "os1", clienteId: "c1", clienteNome: "Cliente A", horas: 2 }),
      item({ osId: "os2", clienteId: "c1", clienteNome: "Cliente A", horas: 3 }),
      item({ osId: "os3", clienteId: "c2", clienteNome: "Cliente B", horas: 10 }),
    ];
    expect(agregarPorCliente(itens)).toEqual([
      { chave: "c2", nome: "Cliente B", totalHoras: 10, totalOs: 1 },
      { chave: "c1", nome: "Cliente A", totalHoras: 5, totalOs: 2 },
    ]);
  });

  it("agrega horas por técnico, agrupa sem-vínculo separadamente", () => {
    const itens = [
      item({ osId: "os1", tecnicoFuncionarioId: null, tecnicoNome: "", horas: 1 }),
      item({ osId: "os2", tecnicoFuncionarioId: "t1", tecnicoNome: "Técnico A", horas: 4 }),
    ];
    const agregado = agregarPorTecnico(itens);
    expect(agregado.find((a) => a.chave === "sem-vinculo")).toEqual({
      chave: "sem-vinculo",
      nome: "Sem técnico",
      totalHoras: 1,
      totalOs: 1,
    });
  });

  it("calcula custo só quando há valor/hora (E04-S06)", () => {
    expect(calcularCusto(10, 50)).toBe(500);
    expect(calcularCusto(10, null)).toBeNull();
    expect(calcularCusto(10, undefined)).toBeNull();
  });
});

describe("apontamento-horas — visão diária (E01-S77)", () => {
  it("formata horas decimais como HHhMMmin, nunca decimal (AC-2/AC-3)", () => {
    expect(formatarHorasMinutos(8.4)).toBe("8h24min");
    expect(formatarHorasMinutos(1.4)).toBe("1h24min");
    expect(formatarHorasMinutos(0)).toBe("0h00min");
    expect(formatarHorasMinutos(-5)).toBe("0h00min"); // clampa negativo (nunca ocorre)
    expect(formatarHorasMinutos(2)).toBe("2h00min");
  });

  it("agrupa por (técnico, dia): span do dia × soma das OS (AC-1/AC-2/AC-3)", () => {
    // 08:00–11:00 local e 14:00–17:00 local (offset −03:00): span 9h, soma 6h → 3h fora de OS
    const dias = agruparPorDia([
      item({
        osId: "a",
        checkInAt: "2026-07-10T11:00:00Z",
        checkOutAt: "2026-07-10T14:00:00Z",
        horas: 3,
      }),
      item({
        osId: "b",
        checkInAt: "2026-07-10T17:00:00Z",
        checkOutAt: "2026-07-10T20:00:00Z",
        horas: 3,
      }),
    ]);
    expect(dias).toHaveLength(1);
    expect(dias[0]?.dia).toBe("2026-07-10");
    expect(dias[0]?.diferencaDiaHoras).toBe(9);
    expect(dias[0]?.somaOsHoras).toBe(6);
    expect(dias[0]?.quantidadeOs).toBe(2);
    expect(dias[0]?.incompleto).toBe(false);
    expect(dias[0]?.ordens).toHaveLength(2);
  });

  it("marca dia incompleto quando falta check-out (AC-5), sem quebrar a soma", () => {
    const dias = agruparPorDia([
      item({
        osId: "a",
        checkInAt: "2026-07-10T11:00:00Z",
        checkOutAt: "2026-07-10T14:00:00Z",
        horas: 3,
      }),
      item({ osId: "b", checkInAt: "2026-07-10T17:00:00Z", checkOutAt: null, horas: 0 }),
    ]);
    expect(dias[0]?.incompleto).toBe(true);
    expect(dias[0]?.somaOsHoras).toBe(3); // OS completa segue contando
  });

  it("OS que cruza a meia-noite fica no dia do check-in e marca incompleto (AC-5, borda)", () => {
    // check-in 17:00 local 07-10, check-out 02:00 local 07-11
    const dias = agruparPorDia([
      item({
        osId: "a",
        checkInAt: "2026-07-10T20:00:00Z",
        checkOutAt: "2026-07-11T05:00:00Z",
        horas: 9,
      }),
    ]);
    expect(dias).toHaveLength(1);
    expect(dias[0]?.dia).toBe("2026-07-10");
    expect(dias[0]?.incompleto).toBe(true);
    expect(dias[0]?.diferencaDiaHoras).toBe(0); // sem check-out no próprio dia
    expect(dias[0]?.somaOsHoras).toBe(9); // duração cheia conta na soma
  });

  it("ignora OS sem check-in nem check-out (borda: não entra em nenhum dia)", () => {
    expect(agruparPorDia([item({ checkInAt: null, checkOutAt: null })])).toHaveLength(0);
  });

  it("sinaliza jornada com tolerância de 15min; sem jornada = neutro (AC-6)", () => {
    expect(sinalizarJornada(8, 8)).toBe("ok");
    expect(sinalizarJornada(8.2, 8)).toBe("ok"); // dentro da tolerância
    expect(sinalizarJornada(7, 8)).toBe("falta");
    expect(sinalizarJornada(9, 8)).toBe("hora-extra");
    expect(sinalizarJornada(5, null)).toBeNull();
    expect(sinalizarJornada(5, undefined)).toBeNull();
  });

  it("gera CSV com cabeçalho e escapa separador (AC-7)", () => {
    const dia: DiaTecnico = {
      chave: "t1|2026-07-10",
      tecnicoFuncionarioId: "t1",
      tecnicoNome: "Silva; João",
      dia: "2026-07-10",
      primeiroCheckIn: "2026-07-10T11:00:00Z",
      ultimoCheckOut: "2026-07-10T20:00:00Z",
      diferencaDiaHoras: 9,
      somaOsHoras: 6,
      quantidadeOs: 2,
      incompleto: false,
      sinalJornada: "hora-extra",
      ordens: [],
    };
    const csv = gerarCsvApontamento([dia]);
    const linhas = csv.split("\n");
    expect(linhas[0]).toBe(
      "Técnico;Dia;Check-in;Check-out;Diferença do dia;Soma das OS;Qtd OS;Status",
    );
    expect(linhas[1]).toContain('"Silva; João"'); // nome com ';' é escapado
    expect(linhas[1]).toContain("08:00"); // check-in local (11:00Z −03:00)
    expect(linhas[1]).toContain("17:00"); // check-out local (20:00Z −03:00)
    expect(linhas[1]).toContain("9h00min"); // diferença do dia
    expect(linhas[1]).toContain("6h00min"); // soma das OS
    expect(linhas[1]).toContain("hora extra");
  });

  it("agrega horas de OS por semana, ordenado por início da semana (AC-8)", () => {
    const semanas = agregarPorSemana([
      item({ osId: "a", checkInAt: "2026-07-06T12:00:00Z", checkOutAt: null, horas: 4 }), // seg 06/07
      item({ osId: "b", checkInAt: "2026-07-08T12:00:00Z", checkOutAt: null, horas: 2 }), // qua 08/07
      item({ osId: "c", checkInAt: "2026-07-14T12:00:00Z", checkOutAt: null, horas: 5 }), // seg 13/07
    ]);
    expect(semanas).toHaveLength(2);
    expect(semanas[0]).toMatchObject({
      semanaInicio: "2026-07-06",
      totalHoras: 6,
      quantidadeOs: 2,
    });
    expect(semanas[1]).toMatchObject({
      semanaInicio: "2026-07-13",
      totalHoras: 5,
      quantidadeOs: 1,
    });
  });
});
