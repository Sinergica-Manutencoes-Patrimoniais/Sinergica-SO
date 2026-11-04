import { expect, it } from "vitest";
import {
  criarEdicaoMateriais,
  dividirLinhaMaterial,
  juntarLinhasMateriais,
} from "./edicao-materiais";

it("divide e junta linhas mantendo texto e trechos originais", () => {
  const original = "- 2 tubos\n- 1 válvula\nProsa ambígua";
  const edicao = criarEdicaoMateriais(original);
  const dividida = dividirLinhaMaterial(edicao, 0, [
    { descricao: "tubo curto", quantidade: "1", unidade: null },
    { descricao: "tubo longo", quantidade: "1", unidade: null },
  ]);
  expect(dividida.textoOriginal).toBe(original);
  expect(dividida.linhas[0]?.trechosOriginais).toEqual(["- 2 tubos"]);
  expect(dividida.linhas[1]?.trechosOriginais).toEqual(["- 2 tubos"]);
  const juntada = juntarLinhasMateriais(dividida, [1, 2], {
    descricao: "tubo longo e válvula",
    quantidade: null,
    unidade: null,
  });
  expect(juntada.textoOriginal).toBe(original);
  expect(juntada.linhas[1]?.trechosOriginais).toEqual(["- 2 tubos", "- 1 válvula"]);
  expect(juntada.linhas[1]?.quantidade).toBeNull();
  expect(juntada.linhas[2]?.descricao).toBe("Prosa ambígua");
  expect(edicao.linhas).toHaveLength(3);
});

it("recusa divisão ou junção inválida sem modificar edição", () => {
  const edicao = criarEdicaoMateriais("- 2 tubos\n- 1 válvula");
  expect(() =>
    dividirLinhaMaterial(edicao, 9, [
      { descricao: "x", quantidade: null, unidade: null },
      { descricao: "y", quantidade: null, unidade: null },
    ]),
  ).toThrow();
  expect(() =>
    juntarLinhasMateriais(edicao, [0, 0], { descricao: "x", quantidade: null, unidade: null }),
  ).toThrow();
  expect(() =>
    juntarLinhasMateriais(edicao, [0, 1], { descricao: " ", quantidade: null, unidade: null }),
  ).toThrow();
  expect(edicao.linhas).toHaveLength(2);
});
