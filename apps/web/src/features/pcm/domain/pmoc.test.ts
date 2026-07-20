import { describe, expect, it } from "vitest";
import {
  type ContratoParaAlerta,
  checklistAcumulado,
  classificarMicrobio,
  contratosComAlerta,
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

  it("triagem cross-contrato: só lista quem tem alerta (AC-1/AC-2)", () => {
    function contrato(over: Partial<ContratoParaAlerta>): ContratoParaAlerta {
      return {
        id: "c1",
        imovelNome: "Imóvel",
        clienteNome: "Cliente",
        status: "ativo",
        microbioPendentes: 0,
        ncsAbertas: 0,
        ncsAltasAbertas: 0,
        visitasAtrasadas: 0,
        ...over,
      };
    }

    const semAlerta = contrato({ id: "ok" });
    const comAtraso = contrato({ id: "atrasado", visitasAtrasadas: 2 });
    const resultado = contratosComAlerta([semAlerta, comAtraso]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ contratoId: "atrasado", tipo: "atrasado" });
  });

  it("prioriza NC alta sobre ART vencendo mesmo quando os dois são verdade (AC-4)", () => {
    function contrato(over: Partial<ContratoParaAlerta>): ContratoParaAlerta {
      return {
        id: "c1",
        imovelNome: "Imóvel",
        clienteNome: "Cliente",
        status: "ativo",
        microbioPendentes: 0,
        ncsAbertas: 0,
        ncsAltasAbertas: 0,
        visitasAtrasadas: 0,
        ...over,
      };
    }

    const duploAlerta = contrato({ id: "duplo", status: "renovar", ncsAltasAbertas: 1 });
    const resultado = contratosComAlerta([duploAlerta]);

    expect(resultado).toHaveLength(1); // não duplica em duas categorias
    expect(resultado[0]?.tipo).toBe("nc_alta"); // categoria mais urgente vence
  });

  it("NC aberta sem severidade alta cai na categoria nc_aberta, não nc_alta", () => {
    function contrato(over: Partial<ContratoParaAlerta>): ContratoParaAlerta {
      return {
        id: "c1",
        imovelNome: "Imóvel",
        clienteNome: "Cliente",
        status: "ativo",
        microbioPendentes: 0,
        ncsAbertas: 1,
        ncsAltasAbertas: 0,
        visitasAtrasadas: 0,
        ...over,
      };
    }

    expect(contratosComAlerta([contrato({ id: "c1" })])[0]?.tipo).toBe("nc_aberta");
  });

  it("ordena por prioridade entre categorias diferentes (AC-4)", () => {
    function contrato(over: Partial<ContratoParaAlerta>): ContratoParaAlerta {
      return {
        id: "c1",
        imovelNome: "Imóvel",
        clienteNome: "Cliente",
        status: "ativo",
        microbioPendentes: 0,
        ncsAbertas: 0,
        ncsAltasAbertas: 0,
        visitasAtrasadas: 0,
        ...over,
      };
    }

    const atrasado = contrato({ id: "atrasado", visitasAtrasadas: 1 });
    const ncAlta = contrato({ id: "nc-alta", ncsAltasAbertas: 1 });
    const microbio = contrato({ id: "microbio", microbioPendentes: 1 });

    const resultado = contratosComAlerta([atrasado, ncAlta, microbio]);
    expect(resultado.map((r) => r.contratoId)).toEqual(["nc-alta", "microbio", "atrasado"]);
  });
});
