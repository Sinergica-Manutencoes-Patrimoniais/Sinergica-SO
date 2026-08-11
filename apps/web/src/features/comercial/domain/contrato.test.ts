import { describe, expect, it } from "vitest";
import {
  type Contrato,
  motivoNaoPodeAtivar,
  podeAtivar,
  podeEncerrar,
  reajusteDevido,
  valorInvalidoParaAtivar,
  vigenciaVencida,
} from "./contrato";

describe("podeAtivar", () => {
  it("só rascunho pode ativar", () => {
    expect(podeAtivar("rascunho")).toBe(true);
    expect(podeAtivar("ativo")).toBe(false);
    expect(podeAtivar("suspenso")).toBe(false);
    expect(podeAtivar("encerrado")).toBe(false);
  });
});

describe("podeEncerrar", () => {
  it("ativo ou suspenso podem encerrar", () => {
    expect(podeEncerrar("ativo")).toBe(true);
    expect(podeEncerrar("suspenso")).toBe(true);
    expect(podeEncerrar("rascunho")).toBe(false);
    expect(podeEncerrar("encerrado")).toBe(false);
  });
});

describe("vigenciaVencida", () => {
  const hoje = new Date("2026-08-11T12:00:00Z");

  it("null nunca vence", () => {
    expect(vigenciaVencida(null, hoje)).toBe(false);
  });

  it("data passada venceu", () => {
    expect(vigenciaVencida("2026-08-10", hoje)).toBe(true);
  });

  it("data futura não venceu", () => {
    expect(vigenciaVencida("2026-08-12", hoje)).toBe(false);
  });

  it("hoje ainda não venceu", () => {
    expect(vigenciaVencida("2026-08-11", hoje)).toBe(false);
  });
});

describe("valorInvalidoParaAtivar", () => {
  it("avulso nunca é inválido, mesmo sem valor", () => {
    expect(valorInvalidoParaAtivar("avulso", null)).toBe(false);
    expect(valorInvalidoParaAtivar("avulso", 0)).toBe(false);
  });

  it("residente/volante exigem valor positivo", () => {
    expect(valorInvalidoParaAtivar("residente", null)).toBe(true);
    expect(valorInvalidoParaAtivar("residente", 0)).toBe(true);
    expect(valorInvalidoParaAtivar("residente", -100)).toBe(true);
    expect(valorInvalidoParaAtivar("volante", 50_000)).toBe(false);
  });
});

describe("motivoNaoPodeAtivar", () => {
  const base: Pick<Contrato, "status" | "tipo" | "valorMensalCentavos" | "vigenciaFim"> = {
    status: "rascunho",
    tipo: "residente",
    valorMensalCentavos: 50_000,
    vigenciaFim: null,
  };

  it("contrato pronto pra ativar: null (sem motivo de bloqueio)", () => {
    expect(motivoNaoPodeAtivar(base)).toBeNull();
  });

  it("status errado bloqueia primeiro", () => {
    expect(motivoNaoPodeAtivar({ ...base, status: "ativo" })).toContain("rascunho");
  });

  it("vigência vencida bloqueia", () => {
    expect(motivoNaoPodeAtivar({ ...base, vigenciaFim: "2020-01-01" })).toContain("Vigência");
  });

  it("valor inválido bloqueia", () => {
    expect(motivoNaoPodeAtivar({ ...base, valorMensalCentavos: 0 })).toContain("Valor mensal");
  });

  it("avulso sem valor não bloqueia", () => {
    expect(motivoNaoPodeAtivar({ ...base, tipo: "avulso", valorMensalCentavos: null })).toBeNull();
  });
});

describe("reajusteDevido", () => {
  it("null nunca é devido", () => {
    expect(reajusteDevido(null, new Date("2026-08-11"))).toBe(false);
  });

  it("mês bate: devido", () => {
    expect(reajusteDevido(8, new Date("2026-08-11T12:00:00"))).toBe(true);
  });

  it("mês não bate: não devido", () => {
    expect(reajusteDevido(1, new Date("2026-08-11T12:00:00"))).toBe(false);
  });
});
