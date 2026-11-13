import { describe, expect, it } from "vitest";
import type { CanalEvolution } from "../domain/canal-evolution";
import { verificarCanal } from "./verificar-canal";
import type { VerificadorDeCanal } from "./verificar-canal";

function canal(overrides: Partial<CanalEvolution> = {}): CanalEvolution {
  return {
    id: "canal-1",
    estado: "conectado_verificado",
    saude: "desconhecida",
    credencialRef: "ref-1",
    ultimoSucessoEm: null,
    ultimoErroEm: null,
    ...overrides,
  };
}

describe("verificarCanal", () => {
  it("sucesso marca saúde saudável e grava o momento", async () => {
    const verificador: VerificadorDeCanal = {
      verificar: async () => ({ sucesso: true, mensagem: "ok" }),
    };
    const { canal: atualizado } = await verificarCanal(
      verificador,
      canal(),
      "2026-11-13T12:00:00Z",
    );
    expect(atualizado.saude).toBe("saudavel");
    expect(atualizado.ultimoSucessoEm).toBe("2026-11-13T12:00:00Z");
    expect(atualizado.estado).toBe("conectado_verificado");
  });

  it("falha de autenticação desconecta na hora, sem esperar investigação", async () => {
    const verificador: VerificadorDeCanal = {
      verificar: async () => ({ sucesso: false, falhaDeAutenticacao: true, mensagem: "401" }),
    };
    const { canal: atualizado } = await verificarCanal(
      verificador,
      canal(),
      "2026-11-13T12:00:00Z",
    );
    expect(atualizado.estado).toBe("desconectado");
    expect(atualizado.saude).toBe("degradada");
    expect(atualizado.ultimoErroEm).toBe("2026-11-13T12:00:00Z");
  });

  it("outra falha só degrada a saúde, não desconecta", async () => {
    const verificador: VerificadorDeCanal = {
      verificar: async () => ({ sucesso: false, mensagem: "timeout" }),
    };
    const { canal: atualizado } = await verificarCanal(
      verificador,
      canal(),
      "2026-11-13T12:00:00Z",
    );
    expect(atualizado.estado).toBe("conectado_verificado");
    expect(atualizado.saude).toBe("degradada");
  });
});
