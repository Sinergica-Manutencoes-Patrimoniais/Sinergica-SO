import { describe, expect, it } from "vitest";
import { ehOsAbertaContavel } from "./contagem-operacional";

// specs/E01-S204-definicao-os-aberta — espelho de pcm.fn_classificar_item_operacao (AC-1, AC-5)
describe("ehOsAbertaContavel", () => {
  const base = { status: "planejamento", titulo: "Troca de lâmpada", chamadoId: "ch-1" };

  it("OS com Chamado e fora do histórico é OS aberta", () => {
    expect(ehOsAbertaContavel(base)).toBe(true);
  });
  it("D2: Validação PCM conta como aberta", () => {
    expect(ehOsAbertaContavel({ ...base, status: "validacao_pcm" })).toBe(true);
  });
  it("D1: pré-chamado (sem Chamado) não é OS aberta", () => {
    expect(ehOsAbertaContavel({ ...base, chamadoId: null })).toBe(false);
  });
  it("histórico não é OS aberta", () => {
    expect(ehOsAbertaContavel({ ...base, status: "finalizado" })).toBe(false);
    expect(ehOsAbertaContavel({ ...base, status: "cancelado" })).toBe(false);
  });
  it("D5: ponto de visita não é OS aberta, com ou sem acento", () => {
    expect(ehOsAbertaContavel({ ...base, titulo: "INÍCIO VISITA " })).toBe(false);
    expect(ehOsAbertaContavel({ ...base, titulo: "fim visita" })).toBe(false);
  });
});
