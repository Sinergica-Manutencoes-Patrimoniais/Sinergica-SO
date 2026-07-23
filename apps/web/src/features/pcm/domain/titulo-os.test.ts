import { describe, expect, it } from "vitest";
import { podeGerarTitulo, sanearTituloGerado } from "./titulo-os";

describe("sanearTituloGerado", () => {
  it("remove aspas envolventes", () => {
    expect(sanearTituloGerado('"Troca de lâmpada, corredor 3º andar"')).toBe(
      "Troca de lâmpada, corredor 3º andar",
    );
  });

  it("colapsa quebras de linha e espaços múltiplos", () => {
    expect(sanearTituloGerado("Troca de\nlâmpada   corredor 3º andar")).toBe(
      "Troca de lâmpada corredor 3º andar",
    );
  });

  it("trunca em 80 caracteres com reticências", () => {
    const bruto = "T".repeat(120);
    const resultado = sanearTituloGerado(bruto);
    expect(resultado.length).toBe(80);
    expect(resultado.endsWith("…")).toBe(true);
  });

  it("não mexe num título já curto e limpo", () => {
    expect(sanearTituloGerado("Vazamento no térreo")).toBe("Vazamento no térreo");
  });
});

describe("podeGerarTitulo", () => {
  it("descrição vazia (ou só espaço): não pode gerar (edge case AC-2)", () => {
    expect(podeGerarTitulo("")).toBe(false);
    expect(podeGerarTitulo("   ")).toBe(false);
  });

  it("descrição com conteúdo: pode gerar", () => {
    expect(podeGerarTitulo("Vazamento visível no teto do 3º andar")).toBe(true);
  });
});
