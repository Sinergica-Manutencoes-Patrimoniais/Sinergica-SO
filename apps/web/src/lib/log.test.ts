import { afterEach, describe, expect, it } from "vitest";
import { definirSink, log } from "./log";

let original: (linha: string) => void;
function capturar(): string[] {
  const linhas: string[] = [];
  original = definirSink((l) => linhas.push(l));
  return linhas;
}
afterEach(() => {
  if (original) definirSink(original);
});

describe("log estruturado", () => {
  it("emite JSON com ts, nivel, msg e campos extras (com reqId)", () => {
    const linhas = capturar();
    log.info("evento", { reqId: "req-1", contagem: 3 });
    expect(linhas).toHaveLength(1);
    const obj = JSON.parse(linhas[0] ?? "{}");
    expect(obj.nivel).toBe("info");
    expect(obj.msg).toBe("evento");
    expect(obj.reqId).toBe("req-1");
    expect(obj.contagem).toBe(3);
    expect(typeof obj.ts).toBe("string");
  });

  it("suporta todos os níveis", () => {
    const linhas = capturar();
    log.debug("d");
    log.warn("w");
    log.error("e");
    const niveis = linhas.map((l) => JSON.parse(l).nivel);
    expect(niveis).toEqual(["debug", "warn", "error"]);
  });
});
