import { describe, expect, it } from "vitest";
import { formularioMudou } from "./nav-guard";

describe("formularioMudou", () => {
  it("retorna false quando estado atual é idêntico ao inicial", () => {
    expect(formularioMudou({ titulo: "", descricao: "" }, { titulo: "", descricao: "" })).toBe(
      false,
    );
  });

  it("retorna true quando algum campo mudou", () => {
    expect(
      formularioMudou({ titulo: "", descricao: "" }, { titulo: "Vazamento", descricao: "" }),
    ).toBe(true);
  });

  it("retorna true quando mais de um campo mudou", () => {
    expect(
      formularioMudou(
        { titulo: "", descricao: "", local: "" },
        { titulo: "Vazamento", descricao: "no térreo", local: "" },
      ),
    ).toBe(true);
  });

  it("ignora ordem de chaves — só compara valores", () => {
    expect(formularioMudou({ a: "1", b: "2" }, { b: "2", a: "1" })).toBe(false);
  });
});
