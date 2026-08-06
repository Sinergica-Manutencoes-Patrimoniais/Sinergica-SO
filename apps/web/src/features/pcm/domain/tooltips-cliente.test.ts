import { describe, expect, it } from "vitest";
import { TOOLTIP_CLIENTE } from "./tooltips-cliente";

describe("TOOLTIP_CLIENTE", () => {
  it("distingue status operacional, comercial e marcação livre", () => {
    expect(TOOLTIP_CLIENTE.status).toMatch(/operacional/i);
    expect(TOOLTIP_CLIENTE.statusComercial).toMatch(/Não é o status operacional/i);
    expect(TOOLTIP_CLIENTE.marcacao).toMatch(/etiqueta livre/i);
  });
});
