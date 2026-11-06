import { describe, expect, it } from "vitest";
import { consolidarEsforcoVisitas } from "./consolidar-esforco-visitas";

describe("esforço declarado por OS", () => {
  it("não toma esforço integral de continuidade como HH restantes", () => {
    const resultado = consolidarEsforcoVisitas([{ osId: "os-continuacao", revision: 1, continuidade: true,
      internosMinutos: 120, terceirosMinutos: 30, acompanhamentoMinutos: 20 }]);
    expect(resultado).toMatchObject({ internosMinutos: 0, terceirosMinutos: 0, estimativasIncompletas: 1, continuacoesPendentes: 1 });
  });
  it("soma HH restantes expressamente confirmadas uma vez por OS", () => {
    const fonte = { osId: "os-continuacao", revision: 2, continuidade: false,
      internosMinutos: 60, terceirosMinutos: 30, acompanhamentoMinutos: 15 };
    expect(consolidarEsforcoVisitas([fonte, fonte])).toMatchObject({ internosMinutos: 75, terceirosMinutos: 30,
      execucaoPropriaMinutos: 60, acompanhamentoMinutos: 15, origensConflitantes: 0 });
  });
  it("não soma fontes da mesma OS que divergem sobre continuidade", () => {
    const fonte = { osId: "os-continuacao", revision: 2, internosMinutos: 60, terceirosMinutos: 30, acompanhamentoMinutos: 15 };
    expect(consolidarEsforcoVisitas([{ ...fonte, continuidade: true }, { ...fonte, continuidade: false }]))
      .toMatchObject({ internosMinutos: 0, terceirosMinutos: 0, origensConflitantes: 1 });
  });
  it("reconhece UUIDs equivalentes com caixas distintas em OS e ocorrência", () => {
    const base = { osId: "os:ABCDEFAB-1234-1234-1234-123456789ABC", ocorrenciaId: "calendario:ABCDEFAB-1234-1234-1234-123456789ABC", revision: 1, internosMinutos: 60, terceirosMinutos: 20, acompanhamentoMinutos: 10 };
    expect(consolidarEsforcoVisitas([base, { ...base, osId: "os:abcdefab-1234-1234-1234-123456789abc", ocorrenciaId: "calendario:abcdefab-1234-1234-1234-123456789abc" }])).toEqual({ internosMinutos: 70, terceirosMinutos: 20, execucaoPropriaMinutos: 60, acompanhamentoMinutos: 10, estimativasIncompletas: 0, origensPendentes: 1, origensConflitantes: 0 });
  });
  it("não soma estimativa de OS terminal ou estado não elegível", () => {
    expect(
      consolidarEsforcoVisitas([
        {
          osId: "fechada",
          revision: 1,
          internosMinutos: 120,
          terceirosMinutos: 30,
          acompanhamentoMinutos: 10,
          podeSomar: false,
        },
      ]),
    ).toEqual({
      internosMinutos: 0,
      terceirosMinutos: 0,
      execucaoPropriaMinutos: 0,
      acompanhamentoMinutos: 0,
      estimativasIncompletas: 0,
      origensPendentes: 1,
      origensConflitantes: 0,
    });
  });
  it("reconhece aliases legado e preparado sem contar duas OS da mesma origem", () => {
    const a = {
      osId: "a",
      ocorrenciaId: "legada:l",
      ocorrenciaIds: ["legada:l", "calendario:p"],
      revision: 1,
      internosMinutos: 20,
      terceirosMinutos: 10,
      acompanhamentoMinutos: 5,
    };
    const b = { ...a, osId: "b", ocorrenciaId: "calendario:p", ocorrenciaIds: ["calendario:p"] };
    expect(consolidarEsforcoVisitas([a, b])).toEqual({
      internosMinutos: 0,
      terceirosMinutos: 0,
      execucaoPropriaMinutos: 0,
      acompanhamentoMinutos: 0,
      estimativasIncompletas: 0,
      origensPendentes: 2,
      origensConflitantes: 2,
    });
  });
  it("não soma OS distintas associadas à mesma ocorrência sem prova de repartição", () => {
    const a = {
      osId: "a",
      ocorrenciaId: "oc-1",
      revision: 1,
      internosMinutos: 120,
      terceirosMinutos: 30,
      acompanhamentoMinutos: 10,
    };
    expect(consolidarEsforcoVisitas([a, { ...a, osId: "b" }])).toEqual({
      internosMinutos: 0,
      terceirosMinutos: 0,
      execucaoPropriaMinutos: 0,
      acompanhamentoMinutos: 0,
      estimativasIncompletas: 0,
      origensPendentes: 2,
      origensConflitantes: 2,
    });
  });
  it("deduplica OS repetida e separa equipe própria de terceiros", () => {
    const a = {
      osId: "a",
      revision: 1,
      internosMinutos: 120,
      terceirosMinutos: 300,
      acompanhamentoMinutos: 30,
    };
    expect(consolidarEsforcoVisitas([a, a])).toEqual({
      internosMinutos: 150,
      terceirosMinutos: 300,
      execucaoPropriaMinutos: 120,
      acompanhamentoMinutos: 30,
      estimativasIncompletas: 0,
      origensPendentes: 1,
      origensConflitantes: 0,
    });
  });
  it("mantém zero e ausência como pendentes sem inventar demanda", () => {
    expect(
      consolidarEsforcoVisitas([
        {
          osId: "b",
          revision: 0,
          internosMinutos: null,
          terceirosMinutos: 0,
          acompanhamentoMinutos: 15,
        },
      ]),
    ).toEqual({
      internosMinutos: 15,
      terceirosMinutos: 0,
      execucaoPropriaMinutos: 0,
      acompanhamentoMinutos: 15,
      estimativasIncompletas: 1,
      origensPendentes: 1,
      origensConflitantes: 0,
    });
  });
  it("não soma versões divergentes da mesma OS", () => {
    const base = {
      osId: "a",
      revision: 1,
      internosMinutos: 60,
      terceirosMinutos: 20,
      acompanhamentoMinutos: 10,
    };
    expect(consolidarEsforcoVisitas([base, { ...base, revision: 2, internosMinutos: 90 }])).toEqual(
      { internosMinutos: 0, terceirosMinutos: 0, execucaoPropriaMinutos: 0, acompanhamentoMinutos: 0, estimativasIncompletas: 0, origensPendentes: 1, origensConflitantes: 1 },
    );
  });
  it("não soma a mesma OS quando aliases secundários divergem", () => {
    const base = { osId: "a", ocorrenciaId: "legada:l", ocorrenciaIds: ["legada:l", "calendario:p"], revision: 1, internosMinutos: 60, terceirosMinutos: 20, acompanhamentoMinutos: 10 };
    expect(consolidarEsforcoVisitas([base, { ...base, ocorrenciaIds: ["legada:l", "calendario:q"] }])).toEqual({
      internosMinutos: 0, terceirosMinutos: 0, execucaoPropriaMinutos: 0, acompanhamentoMinutos: 0, estimativasIncompletas: 0, origensPendentes: 1, origensConflitantes: 1,
    });
  });
  it("aceita aliases equivalentes em ordem diferente", () => {
    const base = { osId: "a", ocorrenciaId: "legada:l", ocorrenciaIds: ["legada:l", "calendario:p"], revision: 1, internosMinutos: 60, terceirosMinutos: 20, acompanhamentoMinutos: 10 };
    expect(consolidarEsforcoVisitas([base, { ...base, ocorrenciaIds: ["calendario:p", "legada:l"] }])).toEqual({
      internosMinutos: 70, terceirosMinutos: 20, execucaoPropriaMinutos: 60, acompanhamentoMinutos: 10, estimativasIncompletas: 0, origensPendentes: 1, origensConflitantes: 0,
    });
  });
});
