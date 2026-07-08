import { describe, expect, it } from "vitest";
import { validarInstanciaAgente } from "./instancias-agente";

describe("validarInstanciaAgente", () => {
  it("aceita dados válidos", () => {
    expect(validarInstanciaAgente({ instanceId: "  inst-1  ", personaId: "persona-1" })).toEqual({
      instanceId: "inst-1",
      personaId: "persona-1",
    });
  });

  it("rejeita instanceId vazio", () => {
    expect(() => validarInstanciaAgente({ instanceId: "", personaId: "persona-1" })).toThrow(
      "Instância é obrigatória.",
    );
  });

  it("rejeita personaId vazio", () => {
    expect(() => validarInstanciaAgente({ instanceId: "inst-1", personaId: "" })).toThrow(
      "Persona é obrigatória.",
    );
  });
});
