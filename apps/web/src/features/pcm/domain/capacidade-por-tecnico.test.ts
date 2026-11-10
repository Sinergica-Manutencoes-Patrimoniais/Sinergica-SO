import { expect, it } from "vitest";
import { agruparCapacidadePorTecnico } from "./capacidade-por-tecnico";

it("associa técnico aos vínculos reais sem inferir saldo ou zerar estimativa ausente", () => {
  expect(agruparCapacidadePorTecnico([{ funcionarioId: "a", disponiveisMinutos: 480 }], [
    { id: "v1", funcionarioId: "a", estimativaMinutos: 60 },
    { id: "v2", funcionarioId: "a", estimativaMinutos: null },
    { id: "v3", funcionarioId: "b", estimativaMinutos: 30 },
  ])).toEqual([
    { funcionarioId: "a", disponibilidade: 480, participacoes: 2, estimativasPendentes: 1, estimativaCompleta: null },
    { funcionarioId: "b", disponibilidade: null, participacoes: 1, estimativasPendentes: 0, estimativaCompleta: 30 },
  ]);
});
it("recusa identidade duplicada ou soma fora de precisão", () => {
  expect(() => agruparCapacidadePorTecnico([], [{ id: "v", funcionarioId: "a", estimativaMinutos: 1 }, { id: "v", funcionarioId: "b", estimativaMinutos: 1 }])).toThrow();
  expect(() => agruparCapacidadePorTecnico([], [{ id: "v", funcionarioId: "a", estimativaMinutos: Number.MAX_SAFE_INTEGER }, { id: "w", funcionarioId: "a", estimativaMinutos: 1 }])).toThrow();
});

it("associa UUIDs equivalentes independentemente de maiúsculas", () => {
  const tecnico = "abcdef12-3456-4789-8abc-0123456789ab";
  expect(agruparCapacidadePorTecnico(
    [{ funcionarioId: tecnico, disponiveisMinutos: 480 }],
    [{ id: "v1", funcionarioId: tecnico.toUpperCase(), estimativaMinutos: 60 }],
  )).toEqual([
    { funcionarioId: tecnico, disponibilidade: 480, participacoes: 1, estimativasPendentes: 0, estimativaCompleta: 60 },
  ]);
});

it("recusa disponibilidade e participação duplicadas com UUIDs em caixa diferente", () => {
  const id = "abcdef12-3456-4789-8abc-0123456789ab";
  expect(() => agruparCapacidadePorTecnico([
    { funcionarioId: id, disponiveisMinutos: 480 },
    { funcionarioId: id.toUpperCase(), disponiveisMinutos: 480 },
  ], [])).toThrow("Disponibilidade inválida.");
  expect(() => agruparCapacidadePorTecnico([], [
    { id, funcionarioId: "a", estimativaMinutos: 60 },
    { id: id.toUpperCase(), funcionarioId: "a", estimativaMinutos: 60 },
  ])).toThrow("Participação inválida.");
});
