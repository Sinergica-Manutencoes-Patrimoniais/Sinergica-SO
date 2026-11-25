import { describe, expect, it } from "vitest";
import {
  LIMITE_DE_BYTES_DO_DIRECT,
  bytesDoTexto,
  janelaDoDirectFechada,
  validarTextoDoDirect,
} from "./instagram-direct";

const AGORA = new Date("2026-11-25T12:00:00.000Z");
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3600_000).toISOString();

describe("janelaDoDirectFechada", () => {
  it("fica aberta com mensagem do contato dentro de 24 h", () => {
    expect(janelaDoDirectFechada([{ direcao: "entrada", createdAt: horasAtras(23) }], AGORA)).toBe(
      false,
    );
  });

  it("fecha quando a última mensagem do contato passou de 24 h", () => {
    expect(janelaDoDirectFechada([{ direcao: "entrada", createdAt: horasAtras(25) }], AGORA)).toBe(
      true,
    );
  });

  it("mensagem NOSSA não reabre a janela — só a do contato conta", () => {
    expect(
      janelaDoDirectFechada(
        [
          { direcao: "entrada", createdAt: horasAtras(30) },
          { direcao: "saida", createdAt: horasAtras(1) },
        ],
        AGORA,
      ),
    ).toBe(true);
  });

  it("conversa sem nenhuma mensagem de entrada está fechada", () => {
    expect(janelaDoDirectFechada([], AGORA)).toBe(true);
  });

  it("data ilegível não abre a janela", () => {
    expect(janelaDoDirectFechada([{ direcao: "entrada", createdAt: "ontem" }], AGORA)).toBe(true);
  });
});

describe("validarTextoDoDirect", () => {
  it("conta BYTES, não caracteres — emoji custa 4", () => {
    expect(bytesDoTexto("😀")).toBe(4);
    const quase = "😀".repeat(LIMITE_DE_BYTES_DO_DIRECT / 4);
    expect(() => validarTextoDoDirect(quase)).not.toThrow();
    expect(() => validarTextoDoDirect(`${quase}a`)).toThrow(/1000 bytes/);
  });

  it("recusa texto vazio", () => {
    expect(() => validarTextoDoDirect("   ")).toThrow(/Escreva a mensagem/);
  });

  it("devolve o texto sem espaços nas pontas", () => {
    expect(validarTextoDoDirect("  oi  ")).toBe("oi");
  });
});
