import { describe, expect, it } from "vitest";
import { filtrarComponentes360 } from "./cliente-360-filtros";

describe("filtros do Cliente 360 — E01-S163 AC-21 desempenho", () => {
  it("mantém p95 abaixo de 100 ms para 1.000 componentes em memória", () => {
    const itens = Array.from({ length: 1_000 }, (_, indice) => ({
      id: `item-${indice}`,
      nome: `Componente ${indice}`,
      identificador: `CLI-PCI-CMP-${String(indice).padStart(4, "0")}`,
      categoriaId: indice % 2 === 0 ? "pci" : "hidraulica",
      areaId: indice % 3 === 0 ? "torre-a" : "torre-b",
      localId: indice % 5 === 0 ? `local-${indice % 10}` : null,
      ativo: indice % 7 !== 0,
      auvoSyncStatus: indice % 11 === 0 ? "error" : "synced",
    }));
    const sistemaPorItem = Object.fromEntries(
      itens.map((item, indice) => [item.id, indice % 4 === 0 ? "sis-pci" : undefined]),
    );
    const duracoes = Array.from({ length: 25 }, () => {
      const inicio = performance.now();
      const resultado = filtrarComponentes360(itens, sistemaPorItem, {
        busca: "cmp",
        categoriaIds: ["pci"],
        areaIds: ["torre-a", "torre-b"],
        localIds: [],
        sistemaIds: [],
        situacao: "ativos",
        syncStatuses: ["synced"],
      });
      expect(resultado.length).toBeGreaterThan(0);
      return performance.now() - inicio;
    }).sort((a, b) => a - b);
    const p95 = duracoes[Math.ceil(duracoes.length * 0.95) - 1];

    expect(p95).toBeLessThan(100);
  });
});
