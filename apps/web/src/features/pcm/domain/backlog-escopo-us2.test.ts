import { describe, expect, it } from "vitest";
import { preverRetornoEscopo } from "./backlog-escopo";

describe("prévia de retorno de escopo", () => {
  it("considera apenas parcelas não resolvidas sem tratamento em outro Chamado", () => {
    const parcelas = [
      { id: "a", clienteId: "c1", chamadoId: "ch1", resolvida: true, emOutroChamado: false },
      { id: "b", clienteId: "c1", chamadoId: "ch1", resolvida: false, emOutroChamado: true },
      { id: "c", clienteId: "c1", chamadoId: "ch1", resolvida: false, emOutroChamado: false },
    ];
    expect(preverRetornoEscopo({ clienteId: "c1", chamadoId: "ch1", parcelas })).toEqual(["c"]);
    expect(parcelas).toHaveLength(3);
    expect(parcelas[0]?.resolvida).toBe(true);
  });
  it("não mistura Cliente nem Chamado, mesmo com identificador de parcela repetido", () => {
    const parcela = {
      id: "a",
      clienteId: "c2",
      chamadoId: "ch1",
      resolvida: false,
      emOutroChamado: false,
    };
    expect(() =>
      preverRetornoEscopo({ clienteId: "c1", chamadoId: "ch1", parcelas: [parcela] }),
    ).toThrow();
    expect(() =>
      preverRetornoEscopo({ clienteId: "c2", chamadoId: "ch2", parcelas: [parcela] }),
    ).toThrow();
  });
  it("recusa duplicidade, identidade ausente e estados indeterminados", () => {
    const parcela = {
      id: "a",
      clienteId: "c1",
      chamadoId: "ch1",
      resolvida: false,
      emOutroChamado: false,
    };
    expect(() =>
      preverRetornoEscopo({ clienteId: "c1", chamadoId: "ch1", parcelas: [parcela, parcela] }),
    ).toThrow();
    expect(() =>
      preverRetornoEscopo({
        clienteId: "c1",
        chamadoId: "ch1",
        parcelas: [{ ...parcela, id: " " }],
      }),
    ).toThrow();
    expect(() =>
      preverRetornoEscopo({
        clienteId: "c1",
        chamadoId: "ch1",
        parcelas: [{ ...parcela, resolvida: null as never }],
      }),
    ).toThrow();
  });
});
