import { describe, expect, it } from "vitest";
import { avaliarPlanoRascunho } from "./plano-manutencao";

const alvo = (id: string, tipo: "sistema" | "componente" | "grupo", clienteId = "cliente-a") => ({
  id,
  tipo,
  clienteId,
});
const rotina = (
  id: string,
  alvoUnico: ReturnType<typeof alvo>,
  intervalo: number,
  tempoMinutos: number | null,
) => ({
  id,
  nome: id,
  alvos: [alvoUnico],
  modo: "calendario" as const,
  intervalo,
  unidade: "meses" as const,
  dataBase: "2026-11-01",
  instrucao: "Inspecionar",
  questionarioId: null,
  tempoMinutos,
  tipoTempo: "total" as const,
  toleranciaAntes: 0,
  toleranciaDepois: 0,
});

describe("rascunho de Plano de Manutenção", () => {
  it("mantém alvos distintos e Rotinas independentes para o mesmo alvo", () => {
    const extintores = alvo("extintores", "sistema");
    const rotinas = [
      rotina("mensal", extintores, 1, 30),
      rotina("semestral", extintores, 6, 90),
      rotina("qgbt", alvo("qgbt", "componente"), 3, 20),
      rotina("luminarias", alvo("luminarias", "grupo"), 12, 0),
    ];
    const resultado = avaliarPlanoRascunho({ clienteId: "cliente-a", nome: "Preventivo", rotinas });
    expect(resultado.rotinas.map((r) => r.id)).toEqual([
      "mensal",
      "semestral",
      "qgbt",
      "luminarias",
    ]);
    expect(resultado.rotinas[0]?.intervalo).toBe(1);
    expect(resultado.rotinas[1]?.intervalo).toBe(6);
    expect(resultado.rotinas[3]?.pendencias).toContain("tempo_a_validar");
  });
  it.each([
    { alvos: [] },
    { alvos: [alvo("a", "sistema"), alvo("b", "grupo")] },
    { alvos: [alvo("b", "sistema", "cliente-b")] },
  ])("recusa rotina com nenhum, múltiplos ou alvo de outro Cliente", ({ alvos }) => {
    expect(() =>
      avaliarPlanoRascunho({
        clienteId: "cliente-a",
        nome: "Plano",
        rotinas: [{ ...rotina("r", alvo("a", "sistema"), 1, 10), alvos }],
      }),
    ).toThrow();
  });
  it("mantém tempo vazio e instrução ausente como pendências, sem impedir rascunho", () => {
    const r = {
      ...rotina("r", alvo("a", "grupo"), 1, null),
      instrucao: "",
      tipoTempo: "por_unidade" as const,
    };
    const resultado = avaliarPlanoRascunho({ clienteId: "cliente-a", nome: "Plano", rotinas: [r] });
    expect(resultado.rotinas[0]?.pendencias).toEqual(
      expect.arrayContaining(["tempo_a_validar", "instrucao_ou_questionario"]),
    );
    expect(resultado.rotinas[0]?.tipoTempo).toBe("por_unidade");
    expect(resultado.possuiPendenciasConhecidas).toBe(true);
  });
  it("não considera questionário em branco como instrução preenchida", () => {
    const r = {
      ...rotina("r", alvo("a", "sistema"), 1, 30),
      instrucao: " ",
      questionarioId: "   ",
    };
    const resultado = avaliarPlanoRascunho({ clienteId: "cliente-a", nome: "Plano", rotinas: [r] });
    expect(resultado.rotinas[0]?.pendencias).toContain("instrucao_ou_questionario");
    expect(resultado.possuiPendenciasConhecidas).toBe(true);
  });
  it("rejeita intervalos ou tolerâncias inválidos", () => {
    expect(() =>
      avaliarPlanoRascunho({
        clienteId: "cliente-a",
        nome: "Plano",
        rotinas: [{ ...rotina("r", alvo("a", "sistema"), 0, 1), toleranciaDepois: -1 }],
      }),
    ).toThrow();
  });
  it("rejeita data-base inexistente", () => {
    expect(() =>
      avaliarPlanoRascunho({
        clienteId: "cliente-a",
        nome: "Plano",
        rotinas: [{ ...rotina("r", alvo("a", "sistema"), 1, 30), dataBase: "2026-02-30" }],
      }),
    ).toThrow();
  });
});
