// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { EVENTO_PRODUTO_CLIENTE_360, registrarEventoCliente360 } from "./cliente-360-telemetria";

describe("telemetria do Cliente 360 — E01-S163 AC-1 AC-5 AC-10 AC-20", () => {
  it("publica somente o contrato técnico, sem campos de texto livre", () => {
    const recebidos: unknown[] = [];
    const receber = (evento: Event) => recebidos.push((evento as CustomEvent).detail);
    window.addEventListener(EVENTO_PRODUTO_CLIENTE_360, receber);

    registrarEventoCliente360({
      nome: "cliente360_filter_changed",
      clienteId: "cliente-tecnico-1",
      aba: "componentes",
    });
    window.removeEventListener(EVENTO_PRODUTO_CLIENTE_360, receber);

    expect(recebidos).toEqual([
      {
        nome: "cliente360_filter_changed",
        clienteId: "cliente-tecnico-1",
        aba: "componentes",
      },
    ]);
  });
});
