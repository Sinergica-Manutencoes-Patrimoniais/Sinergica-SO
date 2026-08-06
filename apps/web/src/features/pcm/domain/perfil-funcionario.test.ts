import { describe, expect, it } from "vitest";
import { alocacoesDaSemanaFuncionario, rotuloQuantidadeOsFuncionario } from "./perfil-funcionario";

describe("perfil-funcionario", () => {
  it("filtra a agenda do funcionário e apresenta estado vazio de OS", () => {
    expect(
      alocacoesDaSemanaFuncionario(
        [
          {
            id: "a",
            funcionarioId: "f",
            funcionarioNome: "Ana",
            clienteId: "c",
            clienteNome: "Cliente",
            data: "2026-08-06",
            horaInicio: null,
            horaFim: null,
          },
        ],
        "f",
      ),
    ).toHaveLength(1);
    expect(rotuloQuantidadeOsFuncionario(0)).toBe("Nenhuma OS no período");
  });
});
