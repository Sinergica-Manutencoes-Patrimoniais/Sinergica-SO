import { describe, expect, it } from "vitest";
import {
  type Local,
  areaConsistente,
  detectaCiclo,
  montarArvore,
  validarArea,
  validarLocal,
  validarLocalTipo,
} from "./hierarquia";

describe("hierarquia — Área", () => {
  it("normaliza cadastro de área", () => {
    expect(validarArea({ clienteId: "c1", nome: "  Torre A  " })).toEqual({
      clienteId: "c1",
      nome: "Torre A",
      descricao: null,
      ordem: 0,
    });
  });

  it("bloqueia nome vazio", () => {
    expect(() => validarArea({ clienteId: "c1", nome: "   " })).toThrow(
      "Nome da Área é obrigatório.",
    );
  });

  it("bloqueia sem cliente", () => {
    expect(() => validarArea({ clienteId: "", nome: "Torre A" })).toThrow("Cliente é obrigatório.");
  });
});

describe("hierarquia — Tipo de Local (catálogo por cliente)", () => {
  it("normaliza cadastro", () => {
    expect(validarLocalTipo({ clienteId: "c1", nome: "  Andar  " })).toEqual({
      clienteId: "c1",
      nome: "Andar",
      ordem: 0,
    });
  });

  it("bloqueia nome vazio", () => {
    expect(() => validarLocalTipo({ clienteId: "c1", nome: " " })).toThrow(
      "Nome do Tipo de Local é obrigatório.",
    );
  });

  it("bloqueia sem cliente", () => {
    expect(() => validarLocalTipo({ clienteId: "", nome: "Andar" })).toThrow(
      "Cliente é obrigatório.",
    );
  });
});

describe("hierarquia — Local", () => {
  it("normaliza cadastro de local (INV-7: área sempre presente)", () => {
    expect(validarLocal({ areaId: "a1", nome: "3º andar", tipoId: "t1" })).toEqual({
      areaId: "a1",
      parentId: null,
      nome: "3º andar",
      tipoId: "t1",
      descricao: null,
      ordem: 0,
    });
  });

  it("bloqueia local sem área", () => {
    expect(() => validarLocal({ areaId: "", nome: "Sala 302" })).toThrow("Área é obrigatória.");
  });

  it("bloqueia nome vazio", () => {
    expect(() => validarLocal({ areaId: "a1", nome: "" })).toThrow("Nome do Local é obrigatório.");
  });
});

describe("hierarquia — INV 1: sem ciclo", () => {
  const locais: Pick<Local, "id" | "parentId">[] = [
    { id: "l1", parentId: null },
    { id: "l2", parentId: "l1" },
    { id: "l3", parentId: "l2" },
  ];

  it("detecta auto-referência direta", () => {
    expect(detectaCiclo(locais, "l1", "l1")).toBe(true);
  });

  it("detecta ciclo indireto (l1 <- l3, mas l3 é neto de l1)", () => {
    expect(detectaCiclo(locais, "l1", "l3")).toBe(true);
  });

  it("permite reparent válido sem ciclo", () => {
    expect(detectaCiclo(locais, "l3", "l1")).toBe(false);
  });

  it("sem parentId nunca é ciclo", () => {
    expect(detectaCiclo(locais, "l1", null)).toBe(false);
  });
});

describe("hierarquia — INV 2: área consistente", () => {
  const locais: Pick<Local, "id" | "areaId">[] = [
    { id: "l1", areaId: "a1" },
    { id: "l2", areaId: "a2" },
  ];

  it("aceita pai na mesma área", () => {
    expect(areaConsistente(locais, "a1", "l1")).toBe(true);
  });

  it("rejeita pai de outra área", () => {
    expect(areaConsistente(locais, "a1", "l2")).toBe(false);
  });

  it("sem parentId é sempre consistente", () => {
    expect(areaConsistente(locais, "a1", null)).toBe(true);
  });
});

describe("hierarquia — montarArvore", () => {
  it("monta árvore pai→filho ordenada", () => {
    const locais: Local[] = [
      {
        id: "l2",
        areaId: "a1",
        parentId: "l1",
        nome: "Sala 302",
        tipoId: null,
        tipoNome: null,
        descricao: null,
        ordem: 0,
        ativo: true,
      },
      {
        id: "l1",
        areaId: "a1",
        parentId: null,
        nome: "3º andar",
        tipoId: null,
        tipoNome: null,
        descricao: null,
        ordem: 0,
        ativo: true,
      },
    ];
    const arvore = montarArvore(locais);
    expect(arvore).toHaveLength(1);
    const raiz = arvore[0];
    expect(raiz?.id).toBe("l1");
    expect(raiz?.filhos).toHaveLength(1);
    expect(raiz?.filhos[0]?.id).toBe("l2");
  });

  it("local órfão (parentId inexistente na lista) vira raiz", () => {
    const locais: Local[] = [
      {
        id: "l1",
        areaId: "a1",
        parentId: "inexistente",
        nome: "Sala",
        tipoId: null,
        tipoNome: null,
        descricao: null,
        ordem: 0,
        ativo: true,
      },
    ];
    expect(montarArvore(locais)).toHaveLength(1);
  });
});
