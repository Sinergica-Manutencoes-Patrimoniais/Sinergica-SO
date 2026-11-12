import { describe, expect, it } from "vitest";
import {
  type CanalEvolution,
  CredencialInvalida,
  TransicaoDeEstadoInvalida,
  marcarConectado,
  marcarConfiguracaoIncompleta,
  marcarDesconectado,
  marcarSessaoCaida,
  precisaReescanear,
  registrarErro,
  registrarSucesso,
  salvarCredencial,
} from "./canal-evolution";

function canal(parcial: Partial<CanalEvolution> = {}): CanalEvolution {
  return {
    id: "canal-1",
    estado: "sem_credencial",
    saude: "desconhecida",
    credencialRef: null,
    ultimoSucessoEm: null,
    ultimoErroEm: null,
    ...parcial,
  };
}

describe("salvarCredencial", () => {
  it("vai para 'configurado', nunca direto a conectado", () => {
    const resultado = salvarCredencial(canal(), "ref-abc");
    expect(resultado.estado).toBe("configurado");
    expect(resultado.credencialRef).toBe("ref-abc");
  });

  it("volta a 'configurado' mesmo que o canal já estivesse conectado (AC-6)", () => {
    const conectado = canal({ estado: "conectado_verificado", credencialRef: "ref-velha" });
    const resultado = salvarCredencial(conectado, "ref-nova");
    expect(resultado.estado).toBe("configurado");
  });

  it("recusa referência vazia", () => {
    expect(() => salvarCredencial(canal(), "   ")).toThrow(CredencialInvalida);
  });
});

describe("marcarConectado", () => {
  it("exige credencial", () => {
    expect(() => marcarConectado(canal())).toThrow(TransicaoDeEstadoInvalida);
  });

  it("conecta quando há credencial", () => {
    const configurado = canal({ estado: "configurado", credencialRef: "ref" });
    expect(marcarConectado(configurado).estado).toBe("conectado_verificado");
  });
});

describe("saúde e sessão caída", () => {
  it("registrarSucesso marca saudável e grava o horário", () => {
    const resultado = registrarSucesso(canal(), "2026-11-12T10:00:00Z");
    expect(resultado.saude).toBe("saudavel");
    expect(resultado.ultimoSucessoEm).toBe("2026-11-12T10:00:00Z");
  });

  it("registrarErro degrada sem desconectar", () => {
    const conectado = canal({ estado: "conectado_verificado", credencialRef: "ref" });
    const resultado = registrarErro(conectado, "2026-11-12T10:00:00Z");
    expect(resultado.saude).toBe("degradada");
    expect(resultado.estado).toBe("conectado_verificado");
  });

  it("marcarSessaoCaida desconecta E degrada no mesmo passo (AC-7)", () => {
    const conectado = canal({ estado: "conectado_verificado", credencialRef: "ref" });
    const resultado = marcarSessaoCaida(conectado, "2026-11-12T10:00:00Z");
    expect(resultado.estado).toBe("desconectado");
    expect(resultado.saude).toBe("degradada");
  });
});

describe("precisaReescanear", () => {
  it("true: desconectado com credencial anterior", () => {
    expect(precisaReescanear(canal({ estado: "desconectado", credencialRef: "ref" }))).toBe(true);
  });

  it("false: desconectado sem credencial — configurar do zero", () => {
    expect(precisaReescanear(canal({ estado: "desconectado", credencialRef: null }))).toBe(false);
  });

  it("false: conectado", () => {
    expect(precisaReescanear(canal({ estado: "conectado_verificado", credencialRef: "ref" }))).toBe(
      false,
    );
  });
});

describe("marcarConfiguracaoIncompleta", () => {
  it("falha no meio deixa retomável, nunca conectado (AC-5)", () => {
    const resultado = marcarConfiguracaoIncompleta(canal({ estado: "configurado" }));
    expect(resultado.estado).toBe("configuracao_incompleta");
  });
});

describe("marcarDesconectado", () => {
  it("é reversível: preserva a credencial", () => {
    const conectado = canal({ estado: "conectado_verificado", credencialRef: "ref" });
    const resultado = marcarDesconectado(conectado);
    expect(resultado.estado).toBe("desconectado");
    expect(resultado.credencialRef).toBe("ref");
  });
});
