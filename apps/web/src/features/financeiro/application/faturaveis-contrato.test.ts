import { describe, expect, it } from "vitest";
import {
  receberFaturavelSchema,
  estornarFaturavelSchema,
  complementarFaturavelSchema,
} from "@sinergica/shared";
const id = "18200000-0000-4000-8000-000000000001";
const outro = "18200000-0000-4000-8000-000000000002";
describe("contratos de item A Faturar", () => {
  it("aceita fato identificado e rejeita valor inválido e campos não previstos", () => {
    const fato = {
      requestId: id,
      clienteId: outro,
      origemTipo: "material_fornecido",
      origemId: id,
      valorCentavos: 12000,
      competencia: "2026-10",
      evidencias: [],
    };
    expect(receberFaturavelSchema.parse(fato)).toEqual(fato);
    expect(receberFaturavelSchema.safeParse({ ...fato, valorCentavos: -1 }).success).toBe(false);
    expect(receberFaturavelSchema.safeParse({ ...fato, competencia: "2026-13" }).success).toBe(
      false,
    );
    expect(receberFaturavelSchema.safeParse({ ...fato, versaoTecnica: 2 }).success).toBe(false);
  });
  it("exige estorno positivo vinculado à alocação e complemento com motivo", () => {
    expect(
      estornarFaturavelSchema.safeParse({
        requestId: id,
        itemId: id,
        alocacaoId: outro,
        expectedRevision: 1,
        valorCentavos: 1,
        motivo: "Correção",
      }).success,
    ).toBe(true);
    expect(
      estornarFaturavelSchema.safeParse({
        requestId: id,
        itemId: id,
        alocacaoId: outro,
        expectedRevision: 1,
        valorCentavos: 0,
        motivo: "Correção",
      }).success,
    ).toBe(false);
    expect(
      complementarFaturavelSchema.safeParse({
        requestId: id,
        itemBaseId: id,
        complementoId: outro,
        expectedRevision: 1,
        valorCentavos: 100,
        motivo: " ",
      }).success,
    ).toBe(false);
  });
});
