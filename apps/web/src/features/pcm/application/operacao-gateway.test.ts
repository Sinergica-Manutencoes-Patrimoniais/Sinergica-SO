import { describe, expect, it } from "vitest";
import {
  type CursorOperacao,
  desserializarCursorOperacao,
  serializarCursorOperacao,
} from "./operacao-gateway";
import { operacaoQueryKeys } from "./operacao-queries";

describe("cursores da operação", () => {
  it.each<CursorOperacao>([
    { ordem: "recentes", createdAt: "2026-08-10T12:00:00.000Z", id: "a" },
    { ordem: "gutd", score: 125, createdAt: "2026-08-10T12:00:00.000Z", id: "b" },
    { ordem: "agenda", dataAgendada: "2026-08-11T10:00:00.000Z", id: "c" },
  ])("serializa e recupera $ordem", (cursor) => {
    expect(desserializarCursorOperacao(serializarCursorOperacao(cursor))).toEqual(cursor);
  });

  it("rejeita cursor estruturalmente inválido", () => {
    expect(() => desserializarCursorOperacao(btoa('{"ordem":"recentes"}'))).toThrow(
      "Cursor de operação inválido",
    );
  });
});

describe("query keys da operação", () => {
  it("não inclui cursor na identidade do feed", () => {
    const base = { ordem: "recentes" as const, limite: 50, status: "ativos" as const };
    expect(operacaoQueryKeys.feed(base)).toEqual(
      operacaoQueryKeys.feed({
        ...base,
        cursor: { ordem: "recentes", createdAt: "2026-08-10T12:00:00Z", id: "x" },
      }),
    );
  });
});
