import { describe, expect, it } from "vitest";
import { agregarHistoricoSistema, ultimaManutencao } from "./historico-ativo";
import type { OsHistoricoItem } from "./historico-ativo";

const os = (patch: Partial<OsHistoricoItem>): OsHistoricoItem => ({
  osId: "os-1",
  numero: "OS-0001",
  categoria: "corretiva",
  status: "finalizado",
  data: "2026-07-01",
  ...patch,
});

describe("historico-ativo", () => {
  describe("ultimaManutencao", () => {
    it("devolve a data do primeiro item (histórico já vem ordenado desc)", () => {
      expect(ultimaManutencao([os({ data: "2026-07-10" }), os({ data: "2026-06-01" })])).toBe(
        "2026-07-10",
      );
    });

    it("AC-3: histórico vazio devolve null, sem erro", () => {
      expect(ultimaManutencao([])).toBeNull();
    });
  });

  describe("agregarHistoricoSistema", () => {
    it("AC-2: junta OS do sistema com as dos componentes", () => {
      const doSistema = [os({ osId: "os-sistema", data: "2026-07-15" })];
      const doComponente1 = [os({ osId: "os-comp-1", data: "2026-07-01" })];
      const doComponente2 = [os({ osId: "os-comp-2", data: "2026-06-01" })];
      const resultado = agregarHistoricoSistema([doSistema, doComponente1, doComponente2]);
      expect(resultado.map((o) => o.osId)).toEqual(["os-sistema", "os-comp-1", "os-comp-2"]);
    });

    it("AC-2: deduplica quando a mesma OS aparece em mais de uma fonte", () => {
      const doSistema = [os({ osId: "os-compartilhada", data: "2026-07-15" })];
      const doComponente = [os({ osId: "os-compartilhada", data: "2026-07-15" })];
      const resultado = agregarHistoricoSistema([doSistema, doComponente]);
      expect(resultado).toHaveLength(1);
    });

    it("ordena o resultado agregado da mais recente pra mais antiga", () => {
      const resultado = agregarHistoricoSistema([
        [os({ osId: "antiga", data: "2026-01-01" })],
        [os({ osId: "recente", data: "2026-07-01" })],
      ]);
      expect(resultado.map((o) => o.osId)).toEqual(["recente", "antiga"]);
    });

    it("AC-3: sem nenhuma fonte com OS, devolve lista vazia", () => {
      expect(agregarHistoricoSistema([[], []])).toEqual([]);
    });
  });
});
