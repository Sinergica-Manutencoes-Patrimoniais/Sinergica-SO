import { describe, expect, it } from "vitest";
import { mapStatusMercadoPago, podeEmitirCobranca } from "./cobranca";

describe("podeEmitirCobranca", () => {
  it("permite entrada previsto", () => {
    expect(podeEmitirCobranca({ tipo: "entrada", status: "previsto" })).toBe(true);
  });
  it("bloqueia entrada já realizada (paga)", () => {
    expect(podeEmitirCobranca({ tipo: "entrada", status: "realizado" })).toBe(false);
  });
  it("bloqueia saída (não é recebível)", () => {
    expect(podeEmitirCobranca({ tipo: "saida", status: "previsto" })).toBe(false);
  });
});

describe("mapStatusMercadoPago", () => {
  it("approved -> pago", () => {
    expect(mapStatusMercadoPago("approved")).toBe("pago");
  });
  it("refunded e charged_back -> estornado", () => {
    expect(mapStatusMercadoPago("refunded")).toBe("estornado");
    expect(mapStatusMercadoPago("charged_back")).toBe("estornado");
  });
  it("cancelled e rejected -> cancelado", () => {
    expect(mapStatusMercadoPago("cancelled")).toBe("cancelado");
    expect(mapStatusMercadoPago("rejected")).toBe("cancelado");
  });
  it("expired -> expirado", () => {
    expect(mapStatusMercadoPago("expired")).toBe("expirado");
  });
  it("pending/in_process/authorized/desconhecido -> pendente", () => {
    expect(mapStatusMercadoPago("pending")).toBe("pendente");
    expect(mapStatusMercadoPago("in_process")).toBe("pendente");
    expect(mapStatusMercadoPago("authorized")).toBe("pendente");
    expect(mapStatusMercadoPago("algo-novo-que-nao-existe-ainda")).toBe("pendente");
  });
});
