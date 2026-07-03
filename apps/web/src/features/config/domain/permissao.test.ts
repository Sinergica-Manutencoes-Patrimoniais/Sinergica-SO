import { describe, expect, it } from "vitest";
import { podeAcessarModulo } from "./permissao";

describe("podeAcessarModulo", () => {
  it("superadmin sempre acessa, mesmo sem nenhuma permissão listada", () => {
    expect(podeAcessarModulo("superadmin", [], "pcm", "escrita")).toBe(true);
  });

  it("nega quando não há permissão para o módulo", () => {
    expect(podeAcessarModulo("colaborador", [], "pcm", "leitura")).toBe(false);
  });

  it("permissão de leitura concede leitura mas não escrita", () => {
    const permissoes = [{ modulo: "pcm", nivel: "leitura" }] as const;
    expect(podeAcessarModulo("colaborador", permissoes, "pcm", "leitura")).toBe(true);
    expect(podeAcessarModulo("colaborador", permissoes, "pcm", "escrita")).toBe(false);
  });

  it("permissão de escrita concede leitura e escrita", () => {
    const permissoes = [{ modulo: "pcm", nivel: "escrita" }] as const;
    expect(podeAcessarModulo("colaborador", permissoes, "pcm", "leitura")).toBe(true);
    expect(podeAcessarModulo("colaborador", permissoes, "pcm", "escrita")).toBe(true);
  });

  it("não vaza acesso para outro módulo não listado", () => {
    const permissoes = [{ modulo: "pcm", nivel: "escrita" }] as const;
    expect(podeAcessarModulo("colaborador", permissoes, "financeiro", "leitura")).toBe(false);
  });
});
