import { expect, it } from "vitest";
import { preverComposicaoBacklog } from "./backlog-escopo";

it("seleciona somente parcelas indicadas sem alterar fontes nem criar execução", () => {
  const parcelas = [
    { id: "a", pendenciaId: "p1", clienteId: "c1", ativaEmBacklog: false },
    { id: "b", pendenciaId: "p2", clienteId: "c1", ativaEmBacklog: false },
    { id: "c", pendenciaId: "p3", clienteId: "c1", ativaEmBacklog: false },
  ];
  expect(preverComposicaoBacklog({ clienteId: "c1", parcelas, selecionadas: ["b", "a"] })).toEqual([
    { parcelaId: "b", pendenciaId: "p2" },
    { parcelaId: "a", pendenciaId: "p1" },
  ]);
  expect(parcelas).toHaveLength(3);
});

it("recusa parcela já ativa, repetida, desconhecida ou de outro Cliente", () => {
  const parcelas = [
    { id: "a", pendenciaId: "p1", clienteId: "c1", ativaEmBacklog: false },
    { id: "b", pendenciaId: "p2", clienteId: "c1", ativaEmBacklog: true },
    { id: "c", pendenciaId: "p3", clienteId: "c2", ativaEmBacklog: false },
  ];
  for (const selecionadas of [["a", "a"], ["b"], ["c"], ["desconhecida"], []]) {
    expect(() => preverComposicaoBacklog({ clienteId: "c1", parcelas, selecionadas })).toThrow();
  }
});

it("recusa fontes ambíguas ou disponibilidade não confirmada", () => {
  const parcela = { id: "a", pendenciaId: "p1", clienteId: "c1", ativaEmBacklog: false };
  expect(() =>
    preverComposicaoBacklog({ clienteId: "c1", parcelas: [parcela, parcela], selecionadas: ["a"] }),
  ).toThrow();
  expect(() =>
    preverComposicaoBacklog({
      clienteId: "c1",
      parcelas: [{ ...parcela, ativaEmBacklog: null as never }],
      selecionadas: ["a"],
    }),
  ).toThrow();
  expect(() =>
    preverComposicaoBacklog({
      clienteId: "c1",
      parcelas: [{ ...parcela, pendenciaId: " " }],
      selecionadas: ["a"],
    }),
  ).toThrow();
});
