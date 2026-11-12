import { describe, expect, it } from "vitest";
import {
  CAPACIDADES_OBRIGATORIAS,
  type EntradaDaMatriz,
  avaliarCompatibilidade,
} from "./evolution-compatibilidade";

const MATRIZ_DE_TESTE: EntradaDaMatriz[] = [
  { versao: "2.1.1", capacidades: [...CAPACIDADES_OBRIGATORIAS] },
  { versao: "2.0.0", capacidades: ["instanceCreate", "qr", "connectionState"] },
];

describe("avaliarCompatibilidade", () => {
  it("aceita versão que prova todas as capacidades obrigatórias", () => {
    const resultado = avaliarCompatibilidade(MATRIZ_DE_TESTE, "2.1.1");
    expect(resultado).toEqual({ compativel: true, versao: "2.1.1" });
  });

  it("recusa versão ausente da matriz", () => {
    const resultado = avaliarCompatibilidade(MATRIZ_DE_TESTE, "9.9.9");
    expect(resultado.compativel).toBe(false);
    if (!resultado.compativel) {
      expect(resultado.motivo).toContain("9.9.9");
      expect(resultado.motivo).toContain("nao esta na matriz");
    }
  });

  it("recusa versão com capacidade faltando, listando quais faltam", () => {
    const resultado = avaliarCompatibilidade(MATRIZ_DE_TESTE, "2.0.0");
    expect(resultado.compativel).toBe(false);
    if (!resultado.compativel) {
      expect(resultado.motivo).toContain("webhookHeaders");
      expect(resultado.motivo).toContain("sendText");
    }
  });

  it("nunca lança exceção, mesmo com matriz vazia", () => {
    expect(() => avaliarCompatibilidade([], "2.1.1")).not.toThrow();
    expect(avaliarCompatibilidade([], "2.1.1").compativel).toBe(false);
  });
});
