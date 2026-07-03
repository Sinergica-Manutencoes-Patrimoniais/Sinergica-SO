import { describe, expect, it } from "vitest";
import { MODULOS_PERMISSIONAVEIS, isModuloId, isNivelAcesso } from "./modulo";

describe("MODULOS_PERMISSIONAVEIS", () => {
  it("tem os 9 módulos de negócio, sem 'inicio'", () => {
    expect(MODULOS_PERMISSIONAVEIS).toHaveLength(9);
    expect(MODULOS_PERMISSIONAVEIS).not.toContain("inicio");
  });
});

describe("isModuloId", () => {
  it.each(MODULOS_PERMISSIONAVEIS)("aceita '%s' como módulo válido", (modulo) => {
    expect(isModuloId(modulo)).toBe(true);
  });

  it("rejeita 'inicio' (não é módulo permissionável)", () => {
    expect(isModuloId("inicio")).toBe(false);
  });

  it("rejeita módulo desconhecido", () => {
    expect(isModuloId("rh")).toBe(false);
  });

  it("rejeita valor não-string", () => {
    expect(isModuloId(42)).toBe(false);
  });
});

describe("isNivelAcesso", () => {
  it("aceita 'leitura' e 'escrita'", () => {
    expect(isNivelAcesso("leitura")).toBe(true);
    expect(isNivelAcesso("escrita")).toBe(true);
  });

  it("rejeita qualquer outro valor", () => {
    expect(isNivelAcesso("admin")).toBe(false);
    expect(isNivelAcesso(null)).toBe(false);
    expect(isNivelAcesso(undefined)).toBe(false);
  });
});
