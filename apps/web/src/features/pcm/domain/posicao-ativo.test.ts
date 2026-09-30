import { describe, expect, it } from "vitest";
import { areaEfetiva } from "./posicao-ativo";

describe("areaEfetiva", () => {
  const locaisPorId = new Map([["local-1", { areaId: "area-do-local" }]]);

  it("usa areaId quando presente, mesmo com localId setado", () => {
    expect(areaEfetiva({ areaId: "area-direta", localId: "local-1" }, locaisPorId)).toBe(
      "area-direta",
    );
  });

  it("deriva do Local quando não tem areaId", () => {
    expect(areaEfetiva({ areaId: null, localId: "local-1" }, locaisPorId)).toBe("area-do-local");
  });

  it("null quando não tem área nem local", () => {
    expect(areaEfetiva({ areaId: null, localId: null }, locaisPorId)).toBeNull();
  });

  it("null quando o local não está no mapa (dado inconsistente)", () => {
    expect(areaEfetiva({ areaId: null, localId: "local-inexistente" }, locaisPorId)).toBeNull();
  });
});
