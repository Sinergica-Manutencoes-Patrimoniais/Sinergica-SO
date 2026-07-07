import { describe, expect, it } from "vitest";
import { validarEquipe } from "./equipes";

describe("equipes", () => {
  const funcionarios = [
    { id: "f1", nome: "Ana", auvoUserId: 10 },
    { id: "f2", nome: "Beto", auvoUserId: null },
  ];

  it("normaliza nome e remove duplicados", () => {
    expect(
      validarEquipe(
        { nome: "  Plantão ", participanteIds: ["f1", "f1"], gestorIds: [] },
        funcionarios,
      ),
    ).toEqual({ nome: "Plantão", participanteIds: ["f1"], gestorIds: [] });
  });

  it("bloqueia técnico sem auvo_user_id", () => {
    expect(() =>
      validarEquipe({ nome: "Time", participanteIds: ["f2"], gestorIds: [] }, funcionarios),
    ).toThrow("Sincronize todos");
  });
});
