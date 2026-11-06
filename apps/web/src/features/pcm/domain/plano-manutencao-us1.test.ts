import { describe, expect, it } from "vitest";
import { avaliarPlanoRascunho, type RotinaRascunho } from "./plano-manutencao";

const rotina: RotinaRascunho = {
  id: "r1", nome: "Inspeção", alvos: [{ id: "s1", tipo: "sistema", clienteId: "c1" }],
  modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-02-28",
  instrucao: "Verificar", questionarioId: null, tempoMinutos: 30, tipoTempo: "total",
  toleranciaAntes: 0, toleranciaDepois: 0,
};

describe("S165 US1: rascunho e escopo", () => {
  it("aceita alvos distintos no Plano, com um alvo por Rotina", () => {
    const resultado = avaliarPlanoRascunho({ clienteId: "c1", nome: "Plano", rotinas: [
      rotina, { ...rotina, id: "r2", alvos: [{ id: "g1", tipo: "grupo", clienteId: "c1" }] },
    ] });
    expect(resultado.rotinas.map((r) => r.alvos[0]?.id)).toEqual(["s1", "g1"]);
    expect(resultado.possuiPendenciasConhecidas).toBe(false);
  });
  it("recusa alvo de outro Cliente ou múltiplos alvos", () => {
    const plano = { clienteId: "c1", nome: "Plano", rotinas: [rotina] };
    expect(() => avaliarPlanoRascunho({ ...plano, rotinas: [{ ...rotina, alvos: [{ id: "s2", tipo: "sistema", clienteId: "c2" }] }] })).toThrow();
    expect(() => avaliarPlanoRascunho({ ...plano, rotinas: [{ ...rotina, alvos: [...rotina.alvos, { id: "g2", tipo: "grupo", clienteId: "c1" }] }] })).toThrow();
  });
  it("mantém pendências de tempo e instrução sem impedir rascunho", () => {
    const resultado = avaliarPlanoRascunho({ clienteId: "c1", nome: "Plano", rotinas: [{ ...rotina, tempoMinutos: null, tipoTempo: null, instrucao: null }] });
    expect(resultado.rotinas[0]?.pendencias).toEqual(expect.arrayContaining(["tempo_a_validar", "instrucao_ou_questionario"]));
    expect(resultado.possuiPendenciasConhecidas).toBe(true);
  });
  it("recusa data impossível e tolerâncias negativas", () => {
    const plano = { clienteId: "c1", nome: "Plano", rotinas: [rotina] };
    expect(() => avaliarPlanoRascunho({ ...plano, rotinas: [{ ...rotina, dataBase: "2026-02-30" }] })).toThrow();
    expect(() => avaliarPlanoRascunho({ ...plano, rotinas: [{ ...rotina, toleranciaAntes: -1 }] })).toThrow();
  });
});
