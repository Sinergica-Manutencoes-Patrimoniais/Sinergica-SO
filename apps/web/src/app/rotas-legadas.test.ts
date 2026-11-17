import { describe, expect, it } from "vitest";
import { todasAsViews } from "./navegacao-sso";
import { ROTAS_LEGADAS, resolverRotaLegada } from "./rotas-legadas";

describe("resolverRotaLegada — AC-3 (toda rota antiga responde, nunca quebra)", () => {
  it("é identidade para qualquer view que não está mapeada (caso de hoje: todas)", () => {
    for (const view of [
      "assessment",
      "pmoc",
      "agenda-tecnico",
      "ferramentas-por-tecnico",
      "dashboard",
    ]) {
      expect(resolverRotaLegada(view)).toBe(view);
    }
  });

  it("toda entrada mapeada aponta para uma view que existe de verdade hoje", () => {
    const alcancaveis = new Set(todasAsViews());
    for (const alvo of Object.values(ROTAS_LEGADAS)) {
      expect(alcancaveis.has(alvo), `destino "${alvo}" não existe em NAVEGACAO_SSO`).toBe(true);
    }
  });

  it("nenhuma entrada mapeia pra si mesma (identidade já é o padrão — mapear é redundante)", () => {
    for (const [de, para] of Object.entries(ROTAS_LEGADAS)) expect(de).not.toBe(para);
  });
});
