import { afterEach, describe, expect, it, vi } from "vitest";
import { FLAGS_SSO, flagLigada, flagsDaJornada, flagsNaoDeclaradas, flagsOrfas } from "./flags-sso";

describe("FLAGS_SSO — registro", () => {
  it("não tem nome duplicado", () => {
    const nomes = FLAGS_SSO.map((f) => f.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("todo nome começa com VITE_SSO_", () => {
    for (const flag of FLAGS_SSO) expect(flag.nome.startsWith("VITE_SSO_")).toBe(true);
  });

  it("toda flag nasce com padrão false — esta story não liga nada", () => {
    for (const flag of FLAGS_SSO) expect(flag.padrao).toBe(false);
  });

  it("tem pelo menos as 737 flags medidas em 2026-11-17", () => {
    expect(FLAGS_SSO.length).toBeGreaterThanOrEqual(737);
  });
});

describe("flagLigada", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa o padrão do registro quando a variável não veio do build", () => {
    expect(flagLigada("VITE_SSO_CRIAR_OS_CHAMADO_ENABLED")).toBe(false);
  });

  it('liga quando a variável de build é "true"', () => {
    vi.stubEnv("VITE_SSO_CRIAR_OS_CHAMADO_ENABLED", "true");
    expect(flagLigada("VITE_SSO_CRIAR_OS_CHAMADO_ENABLED")).toBe(true);
  });

  it('desliga explicitamente quando a variável de build é "false", mesmo com padrão true', () => {
    vi.stubEnv("VITE_SSO_CRIAR_OS_CHAMADO_ENABLED", "false");
    expect(flagLigada("VITE_SSO_CRIAR_OS_CHAMADO_ENABLED")).toBe(false);
  });

  it("flag fora do registro cai no padrão false, nunca lança", () => {
    expect(flagLigada("VITE_SSO_NAO_EXISTE_NO_REGISTRO_ENABLED" as never)).toBe(false);
  });
});

describe("flagsDaJornada", () => {
  it("devolve só flags da jornada pedida", () => {
    const chamado1n = flagsDaJornada("chamado-1n");
    expect(chamado1n.length).toBeGreaterThan(0);
    for (const flag of chamado1n) expect(flag.jornada).toBe("chamado-1n");
  });
});

describe("flagsNaoDeclaradas — condição 1 do gate de CI (AC-1)", () => {
  it("não acusa nenhuma flag que já está no registro", () => {
    const lidas = FLAGS_SSO.slice(0, 5).map((f) => f.nome);
    expect(flagsNaoDeclaradas(lidas)).toEqual([]);
  });

  it("acusa flag lida no código que não está no registro", () => {
    const resultado = flagsNaoDeclaradas(["VITE_SSO_INVENTADA_AGORA_ENABLED"]);
    expect(resultado).toEqual(["VITE_SSO_INVENTADA_AGORA_ENABLED"]);
  });
});

describe("flagsOrfas — condição 2 do gate de CI (AC-2)", () => {
  it("não acusa nada quando todo o registro está sendo lido", () => {
    const todas = FLAGS_SSO.map((f) => f.nome);
    expect(flagsOrfas(todas)).toEqual([]);
  });

  it("acusa entrada do registro que nenhum arquivo lê", () => {
    const semUma = FLAGS_SSO.slice(1).map((f) => f.nome);
    const orfas = flagsOrfas(semUma);
    expect(orfas).toHaveLength(1);
    expect(orfas[0]?.nome).toBe(FLAGS_SSO[0]?.nome);
  });
});
