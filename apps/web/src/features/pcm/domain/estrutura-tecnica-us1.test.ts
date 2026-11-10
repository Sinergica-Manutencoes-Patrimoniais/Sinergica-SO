import { describe, expect, it } from "vitest";
import { validarEquipamento, validarParentItem } from "./equipamentos";
import { areaConsistente, detectaCiclo, montarArvore, type Local } from "./hierarquia";

const local = (id: string, areaId: string, parentId: string | null): Local => ({
  id,
  areaId,
  parentId,
  nome: id,
  tipoId: null,
  tipoNome: null,
  descricao: null,
  ordem: 0,
  ativo: true,
});

describe("E01-S176 US1 — estrutura física e identidade dos ativos", () => {
  it("preserva Cliente, código e níveis flexíveis ao validar Componentes pai/filho", () => {
    const condensadora = validarEquipamento({
      nome: "  Condensadora VRF  ",
      identificador: "VRF-01",
      categoriaId: "cat-vrf",
      clientId: "cliente-a",
      areaId: "area-a",
      localId: "local-a",
      tipo: "equipamento",
    });
    const evaporadora = validarEquipamento({
      nome: "Evaporadora Ala Norte",
      identificador: "VRF-01-EV-01",
      categoriaId: "cat-vrf",
      clientId: "cliente-a",
      areaId: "area-a",
      localId: "local-b",
      tipo: "componente",
      parentItemId: "ativo-condensadora",
    });

    expect(condensadora).toMatchObject({
      nome: "Condensadora VRF",
      identificador: "VRF-01",
      clientId: "cliente-a",
      areaId: "area-a",
      localId: "local-a",
    });
    expect(evaporadora).toMatchObject({
      identificador: "VRF-01-EV-01",
      tipo: "componente",
      parentItemId: "ativo-condensadora",
      localId: "local-b",
    });
    expect(() => validarParentItem("cliente-a", { clientId: "cliente-a", tipo: "equipamento" })).not.toThrow();
    expect(() => validarParentItem("cliente-a", { clientId: "cliente-b", tipo: "equipamento" })).toThrow(
      "O Componente pai deve pertencer ao mesmo cliente.",
    );
  });

  it("rejeita ciclo/autoparente e pai de Local em Área diferente", () => {
    const locais = [local("raiz", "area-a", null), local("filho", "area-a", "raiz")];
    expect(detectaCiclo(locais, "raiz", "filho")).toBe(true);
    expect(detectaCiclo(locais, "filho", "filho")).toBe(true);
    expect(detectaCiclo(locais, "filho", "raiz")).toBe(false);
    expect(areaConsistente(locais, "area-a", "raiz")).toBe(true);
    expect(areaConsistente(locais, "area-b", "raiz")).toBe(false);
    expect(areaConsistente(locais, "area-a", "ausente")).toBe(false);
  });

  it("mantém a árvore local flexível sem inventar níveis físicos", () => {
    const arvore = montarArvore([
      local("sala-302", "area-a", "andar-3"),
      local("andar-3", "area-a", null),
      local("sala-eletrica", "area-a", null),
    ]);
    expect(arvore.map((no) => no.id)).toEqual(["andar-3", "sala-eletrica"]);
    expect(arvore[0]?.filhos.map((no) => no.id)).toEqual(["sala-302"]);
  });
});
