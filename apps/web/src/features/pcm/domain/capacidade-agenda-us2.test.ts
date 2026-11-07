import { describe, expect, it } from "vitest";
import { simularRemanejamento } from "./capacidade-agenda";

describe("simulação de remanejamento", () => {
  const pedido = {
    vencimento: "2026-12-31",
    programada: null,
    destino: "2027-01-04",
    esforcoMinutos: 120,
    origem: { semanaInicio: "2026-12-28", disponiveisMinutos: 480, demandaMinutos: 600, completa: true },
    destinoSemana: { semanaInicio: "2027-01-04", disponiveisMinutos: 480, demandaMinutos: 420, completa: true },
    equipe: { simultaneidade: false, qualificacao: true, conflito: true },
  } as const;

  it("compara semanas, mantém vencimento e sinaliza sobrecarga e equipe inviável", () => {
    const r = simularRemanejamento(pedido);
    expect(r.baselineSemana).toBe("2026-12-28");
    expect(r.origem).toEqual({ semanaInicio: "2026-12-28", antes: -120, depois: 0 });
    expect(r.destino).toEqual({ semanaInicio: "2027-01-04", antes: 60, depois: -60 });
    expect(r.alertas).toEqual(["sobrecarga", "simultaneidade_incompativel", "conflito"]);
  });

  it("usa data programada como origem sem mover baseline de vencimento", () => {
    const r = simularRemanejamento({ ...pedido, programada: "2027-01-05", destino: "2027-01-06", origem: pedido.destinoSemana });
    expect(r.baselineSemana).toBe("2026-12-28");
    expect(r.origem.antes).toBe(60);
    expect(r.origem.depois).toBe(60);
    expect(r.destino.depois).toBe(60);
  });

  it("não calcula saldo a partir de cobertura ou esforço incompletos", () => {
    const r = simularRemanejamento({ ...pedido, esforcoMinutos: null, destinoSemana: { ...pedido.destinoSemana, completa: false }, equipe: { simultaneidade: null, qualificacao: null, conflito: null } });
    expect(r.origem.depois).toBeNull();
    expect(r.destino.antes).toBeNull();
    expect(r.destino.depois).toBeNull();
    expect(r.alertas).toContain("equipe_nao_verificada");
    expect(r.alertas).not.toContain("sobrecarga");
  });

  it("recusa semanas incompatíveis e retirada maior que demanda completa", () => {
    expect(() => simularRemanejamento({ ...pedido, origem: { ...pedido.origem, semanaInicio: "2027-01-04" } })).toThrow("Semana incompatível");
    expect(() => simularRemanejamento({ ...pedido, esforcoMinutos: 601 })).toThrow("Esforço excede");
    expect(() => simularRemanejamento({ ...pedido, esforcoMinutos: 0 })).toThrow("Esforço não pode ser zero");
  });

  it("não aceita fotografias divergentes para a mesma semana", () => {
    expect(() => simularRemanejamento({ ...pedido, programada: "2027-01-05", destino: "2027-01-06", origem: { ...pedido.destinoSemana, demandaMinutos: 100 } })).toThrow("Fotografias");
  });

  it("não considera completa uma fonte com números ausentes nem esconde qualificação incompatível", () => {
    const r = simularRemanejamento({ ...pedido, origem: { ...pedido.origem, demandaMinutos: null }, equipe: { simultaneidade: true, qualificacao: false, conflito: false } });
    expect(r.origem.antes).toBeNull();
    expect(r.origem.depois).toBeNull();
    expect(r.alertas).toContain("qualificacao_incompativel");
  });
});
