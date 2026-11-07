import { describe, expect, it } from "vitest";
import {
  registrarDespesaVisitaSchema,
  ratearDespesaVisitaSchema,
  cancelarDespesaVisitaSchema,
} from "@sinergica/shared";
import { validarRateioDespesa } from "../infrastructure/supabase-despesas-visita-adapter";

const id = "18000000-0000-4000-8000-000000000001";
const outro = "18000000-0000-4000-8000-000000000002";
describe("contrato de despesas de Visita", () => {
  it("aceita previsto, realizado zero e referências sem incluir Cliente ou ator", () => {
    const comando = {
      requestId: id,
      despesaId: outro,
      visitaId: id,
      categoriaId: outro,
      data: "2026-10-27",
      descricao: "Estacionamento",
      previstoCentavos: 10000,
      realizadoCentavos: 0,
      comprovantes: [],
    };
    expect(registrarDespesaVisitaSchema.parse(comando)).toEqual(comando);
    expect(registrarDespesaVisitaSchema.safeParse({ ...comando, clienteId: id }).success).toBe(
      false,
    );
    expect(
      registrarDespesaVisitaSchema.safeParse({ ...comando, realizadoCentavos: 0.5 }).success,
    ).toBe(false);
  });
  it("rejeita rateio com OS repetida e cancelamento sem motivo", () => {
    expect(
      ratearDespesaVisitaSchema.safeParse({
        requestId: id,
        despesaId: outro,
        expectedRevision: 1,
        parcelas: [{ osId: id, valorCentavos: 50 }],
      }).success,
    ).toBe(true);
    expect(
      ratearDespesaVisitaSchema.safeParse({
        requestId: id,
        despesaId: outro,
        expectedRevision: 1,
        parcelas: [
          { osId: id, valorCentavos: 50 },
          { osId: id, valorCentavos: 50 },
        ],
      }).success,
    ).toBe(false);
    expect(
      cancelarDespesaVisitaSchema.safeParse({
        requestId: id,
        despesaId: outro,
        expectedRevision: 1,
        motivo: " ",
      }).success,
    ).toBe(false);
  });
  it("rejeita o mesmo UUID em caixas diferentes nos dois contratos de rateio", () => {
    const uuid = "abcdefab-0000-4000-8000-000000000001";
    expect(ratearDespesaVisitaSchema.safeParse({
      requestId: id, despesaId: outro, expectedRevision: 1,
      parcelas: [{ osId: uuid, valorCentavos: 50 }, { osId: uuid.toUpperCase(), valorCentavos: 50 }],
    }).success).toBe(false);
    expect(() => validarRateioDespesa({
      requestId: id, despesaId: outro, visitaId: id, expectedRevision: 1,
      parcelas: [{ vinculoId: uuid, valorCentavos: 50 }, { vinculoId: uuid.toUpperCase(), valorCentavos: 50 }],
    })).toThrow();
  });
});
