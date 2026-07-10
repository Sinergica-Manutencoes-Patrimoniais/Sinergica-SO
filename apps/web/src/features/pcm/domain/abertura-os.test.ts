import { describe, expect, it } from "vitest";
import { sugerirPrioridadePorGut } from "./abertura-os";

describe("abertura manual de OS", () => {
  it("AC-3: sugere prioridade por score GUT", () => {
    expect(sugerirPrioridadePorGut(5, 5, 5)).toBe("critica");
    expect(sugerirPrioridadePorGut(4, 4, 4)).toBe("alta");
    expect(sugerirPrioridadePorGut(3, 3, 3)).toBe("media");
    expect(sugerirPrioridadePorGut(1, 2, 2)).toBe("baixa");
  });
});
