import { describe, expect, it } from "vitest";
import {
  interpolarMensagem,
  labelDiaOffset,
  pontoAtingido,
  validarPontoRegua,
} from "./regua-cobranca";

describe("labelDiaOffset", () => {
  it("formata offsets negativos, positivos e zero", () => {
    expect(labelDiaOffset(-3)).toBe("D-3");
    expect(labelDiaOffset(3)).toBe("D+3");
    expect(labelDiaOffset(0)).toBe("No vencimento");
  });
});

describe("validarPontoRegua", () => {
  const base = { diaOffset: -3, canal: "whatsapp" as const, mensagemModelo: "Olá {{cliente}}" };

  it("exige mensagem-modelo", () => {
    expect(() => validarPontoRegua({ ...base, mensagemModelo: "" })).toThrow(
      "Mensagem-modelo é obrigatória.",
    );
  });

  it("aceita ponto válido", () => {
    expect(validarPontoRegua(base).diaOffset).toBe(-3);
  });
});

describe("pontoAtingido", () => {
  it("D-3 atinge 3 dias antes do vencimento", () => {
    expect(pontoAtingido("2026-08-10", -3, "2026-08-07")).toBe(true);
    expect(pontoAtingido("2026-08-10", -3, "2026-08-06")).toBe(false);
  });

  it("D+7 atinge 7 dias depois do vencimento", () => {
    expect(pontoAtingido("2026-08-10", 7, "2026-08-17")).toBe(true);
    expect(pontoAtingido("2026-08-10", 7, "2026-08-16")).toBe(false);
  });

  it("catch-up: continua atingido mesmo dias depois do ponto exato (cron que não rodou)", () => {
    expect(pontoAtingido("2026-08-10", 7, "2026-08-20")).toBe(true);
  });
});

describe("interpolarMensagem", () => {
  it("substitui os placeholders conhecidos", () => {
    const resultado = interpolarMensagem(
      "Olá {{cliente}}, você tem R$ {{valor}} vencendo em {{vencimento}}.",
      {
        cliente: "Condomínio X",
        valorFormatado: "150,00",
        vencimentoFormatado: "10/08/2026",
      },
    );
    expect(resultado).toBe("Olá Condomínio X, você tem R$ 150,00 vencendo em 10/08/2026.");
  });
});
