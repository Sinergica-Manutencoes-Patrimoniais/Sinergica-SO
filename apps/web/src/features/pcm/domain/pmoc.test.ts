import { describe, expect, it } from "vitest";
import {
  checklistAcumulado,
  classificarMicrobio,
  gerarCronogramaPmoc,
  inferirTipoEquipamentoPmoc,
  proximaTagPmoc,
  tipoManutencaoPorMes,
  validarTransicaoStatusNc,
} from "./pmoc";

describe("pmoc", () => {
  it("classifica a manutenção mais alta de cada mês do PMOC", () => {
    expect(tipoManutencaoPorMes(1)).toBe("mensal");
    expect(tipoManutencaoPorMes(3)).toBe("trimestral");
    expect(tipoManutencaoPorMes(6)).toBe("semestral");
    expect(tipoManutencaoPorMes(12)).toBe("anual");
  });

  it("gera cronograma anual preservando o dia possível do mês", () => {
    const cronograma = gerarCronogramaPmoc("2026-01-31");

    expect(cronograma).toHaveLength(12);
    expect(cronograma[0]).toMatchObject({
      scheduledDate: "2026-01-31",
      maintenanceType: "mensal",
      monthRef: 1,
    });
    expect(cronograma[1]?.scheduledDate).toBe("2026-02-28");
    expect(cronograma[5]?.maintenanceType).toBe("semestral");
    expect(cronograma[11]).toMatchObject({
      scheduledDate: "2026-12-31",
      maintenanceType: "anual",
      monthRef: 12,
    });
  });

  it("monta checklist acumulativo por periodicidade", () => {
    expect(checklistAcumulado("mensal").some((item) => item.id.startsWith("t_"))).toBe(false);
    expect(checklistAcumulado("trimestral").some((item) => item.id.startsWith("m_"))).toBe(true);
    expect(checklistAcumulado("semestral").some((item) => item.obrigatorio)).toBe(true);
    expect(checklistAcumulado("anual").some((item) => item.id === "a_d_01")).toBe(true);
  });

  it("classifica resultado microbiológico conforme limites legais", () => {
    expect(classificarMicrobio({ fungiUfcM3: null, ieRatio: null, coliformsResult: null })).toBe(
      "pendente",
    );
    expect(
      classificarMicrobio({ fungiUfcM3: 200, ieRatio: 1.2, coliformsResult: "ausencia" }),
    ).toBe("conforme");
    expect(
      classificarMicrobio({ fungiUfcM3: 751, ieRatio: 1.2, coliformsResult: "ausencia" }),
    ).toBe("nao_conforme");
    expect(
      classificarMicrobio({ fungiUfcM3: 200, ieRatio: 1.6, coliformsResult: "ausencia" }),
    ).toBe("nao_conforme");
    expect(
      classificarMicrobio({ fungiUfcM3: 200, ieRatio: 1.2, coliformsResult: "presenca" }),
    ).toBe("nao_conforme");
  });

  it("infere tipo e próxima tag ao importar inventário do Auvo", () => {
    expect(inferirTipoEquipamentoPmoc("Split Cassete sala 01")).toBe("cassete");
    expect(inferirTipoEquipamentoPmoc("VRF cobertura")).toBe("vrf-vrv");
    expect(inferirTipoEquipamentoPmoc("Fan Coil auditório")).toBe("fancoil");
    expect(inferirTipoEquipamentoPmoc("Equipamento sem categoria")).toBe("outro");
    expect(proximaTagPmoc(["AC-01", "AC-09", "Bomba 1"])).toBe("AC-10");
  });

  it("valida transição de status de NC — só rejeita o pulo aberto->fechado (AC-6)", () => {
    expect(() => validarTransicaoStatusNc("aberto", "fechado")).toThrow(
      "NC deve passar por 'em andamento' antes de ser fechada.",
    );
    expect(() => validarTransicaoStatusNc("aberto", "em_andamento")).not.toThrow();
    expect(() => validarTransicaoStatusNc("em_andamento", "fechado")).not.toThrow();
    // reabrir (recorrência) é permitido
    expect(() => validarTransicaoStatusNc("fechado", "em_andamento")).not.toThrow();
    expect(() => validarTransicaoStatusNc("em_andamento", "aberto")).not.toThrow();
  });
});
