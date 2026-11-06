import { describe, expect, it } from "vitest";
import { avaliarCienciaParaEnvio, resolverPoliticaCiencia } from "./visitas";

describe("política de ciência", () => {
  it("resolve precedência Visita, contrato, Cliente e padrão", () => {
    expect(
      resolverPoliticaCiencia({
        visita: "informativa",
        contrato: "obrigatoria",
        cliente: "sem_controle",
      }),
    ).toEqual({ modo: "informativa", origem: "visita" });
    expect(
      resolverPoliticaCiencia({ visita: null, contrato: "obrigatoria", cliente: "informativa" }),
    ).toEqual({ modo: "obrigatoria", origem: "contrato" });
    expect(
      resolverPoliticaCiencia({ visita: null, contrato: null, cliente: "informativa" }),
    ).toEqual({ modo: "informativa", origem: "cliente" });
    expect(resolverPoliticaCiencia({ visita: null, contrato: null, cliente: null })).toEqual({
      modo: "sem_controle",
      origem: "padrao",
    });
  });
  it("não bloqueia envio por ausência de ciência no padrão ou modo informativo", () => {
    expect(avaliarCienciaParaEnvio("sem_controle", null)).toEqual({
      liberada: true,
      pendencias: [],
    });
    expect(avaliarCienciaParaEnvio("informativa", null)).toEqual({
      liberada: true,
      pendencias: [],
    });
  });
  it("modo obrigatório exige confirmação e dados de rastreabilidade", () => {
    expect(avaliarCienciaParaEnvio("obrigatoria", null)).toEqual({
      liberada: false,
      pendencias: ["confirmacao_cliente"],
    });
    expect(
      avaliarCienciaParaEnvio("obrigatoria", {
        confirmada: true,
        data: "2026-11-01",
        responsavel: " ",
        canal: "",
        observacao: null,
      }),
    ).toEqual({ liberada: false, pendencias: ["responsavel", "canal", "observacao"] });
    expect(
      avaliarCienciaParaEnvio("obrigatoria", {
        confirmada: true,
        data: "2026-11-01",
        responsavel: "Maria",
        canal: "Telefone",
        observacao: "Confirmou acesso",
      }),
    ).toEqual({ liberada: true, pendencias: [] });
  });
  it("data inexistente não comprova ciência", () => {
    expect(
      avaliarCienciaParaEnvio("obrigatoria", {
        confirmada: true,
        data: "2026-02-30",
        responsavel: "Maria",
        canal: "Telefone",
        observacao: "Confirmou acesso",
      }),
    ).toEqual({ liberada: false, pendencias: ["data"] });
  });
  it("não trata política desconhecida como autorização", () => {
    expect(() => avaliarCienciaParaEnvio("desconhecida" as never, null)).toThrow();
    expect(() =>
      resolverPoliticaCiencia({ visita: "desconhecida" as never, contrato: null, cliente: null }),
    ).toThrow();
  });
});
