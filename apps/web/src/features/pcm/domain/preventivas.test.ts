import { describe, expect, it } from "vitest";
import {
  type PlanoPreventivoRecorrente,
  calcularStatusOcorrenciaPreventiva,
  gerarVencimentosPreventivos,
  podeEditarEstruturaPlano,
} from "./preventivas";

describe("preventivas", () => {
  it("gera vencimentos semanais dentro do período, incluindo limites", () => {
    const plano: PlanoPreventivoRecorrente = {
      dataInicial: "2026-01-02",
      intervalo: { quantidade: 2, unidade: "semanas" },
    };

    expect(gerarVencimentosPreventivos(plano, "2026-01-01", "2026-02-13")).toEqual([
      "2026-01-02",
      "2026-01-16",
      "2026-01-30",
      "2026-02-13",
    ]);
  });

  it("mantém âncora mensal no dia original após mês curto", () => {
    const plano: PlanoPreventivoRecorrente = {
      dataInicial: "2026-01-31",
      intervalo: { quantidade: 1, unidade: "meses" },
    };

    expect(gerarVencimentosPreventivos(plano, "2026-01-01", "2026-05-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("não muda recorrência por execução tardia", () => {
    const plano: PlanoPreventivoRecorrente = {
      dataInicial: "2026-01-31",
      intervalo: { quantidade: 1, unidade: "meses" },
    };

    expect(gerarVencimentosPreventivos(plano, "2026-04-01", "2026-06-30")).toEqual([
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
    ]);
  });

  it("deriva status por vencimento e OS vinculada", () => {
    expect(calcularStatusOcorrenciaPreventiva({ vencimento: "2026-04-11" }, "2026-04-10")).toBe(
      "prevista",
    );
    expect(calcularStatusOcorrenciaPreventiva({ vencimento: "2026-04-09" }, "2026-04-10")).toBe(
      "atrasada",
    );
    expect(
      calcularStatusOcorrenciaPreventiva(
        { vencimento: "2026-04-09", ordemServico: { status: "aberta" } },
        "2026-04-10",
      ),
    ).toBe("agendada");
    expect(
      calcularStatusOcorrenciaPreventiva(
        { vencimento: "2026-04-11", ordemServico: { status: "finalizada" } },
        "2026-04-10",
      ),
    ).toBe("concluida");
  });

  it("valida datas calendário em vez de aceitar rollover local", () => {
    const plano: PlanoPreventivoRecorrente = {
      dataInicial: "2026-02-30",
      intervalo: { quantidade: 1, unidade: "meses" },
    };

    expect(() => gerarVencimentosPreventivos(plano, "2026-01-01", "2026-12-31")).toThrow(
      "Data inválida",
    );
  });

  it("bloqueia edição estrutural após materializar uma ocorrência", () => {
    expect(podeEditarEstruturaPlano([])).toBe(true);
    expect(podeEditarEstruturaPlano([{ vencimento: "2026-10-06" }])).toBe(false);
  });
});
