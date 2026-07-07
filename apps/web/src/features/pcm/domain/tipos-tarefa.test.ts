import { describe, expect, it } from "vitest";
import { validarTipoTarefa } from "./tipos-tarefa";

describe("validarTipoTarefa", () => {
  it("normaliza nome e aplica ativo default", () => {
    expect(
      validarTipoTarefa({
        nome: "  Manutenção preventiva  ",
        preencheRelato: true,
        exigeAssinatura: false,
        fotosMinimas: 2,
      }),
    ).toEqual({
      nome: "Manutenção preventiva",
      preencheRelato: true,
      exigeAssinatura: false,
      fotosMinimas: 2,
      ativo: true,
    });
  });

  it("rejeita nome vazio", () => {
    expect(() =>
      validarTipoTarefa({
        nome: " ",
        preencheRelato: false,
        exigeAssinatura: false,
        fotosMinimas: 0,
      }),
    ).toThrow("Nome é obrigatório.");
  });

  it("rejeita fotos mínimas negativa ou fracionária", () => {
    expect(() =>
      validarTipoTarefa({
        nome: "Inspeção",
        preencheRelato: false,
        exigeAssinatura: false,
        fotosMinimas: -1,
      }),
    ).toThrow("Fotos mínimas");
    expect(() =>
      validarTipoTarefa({
        nome: "Inspeção",
        preencheRelato: false,
        exigeAssinatura: false,
        fotosMinimas: 1.5,
      }),
    ).toThrow("Fotos mínimas");
  });
});
