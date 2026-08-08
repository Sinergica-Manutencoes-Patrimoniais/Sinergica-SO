// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { tokenCor } from "./token-cor";

describe("tokenCor — E00-S14", () => {
  it("resolve a variável CSS --color-{nome} do :root", () => {
    document.documentElement.style.setProperty("--color-danger", "#a23b25");
    expect(tokenCor("danger")).toBe("#a23b25");
  });

  it("devolve string vazia sem document (SSR/teste sem DOM)", () => {
    const docOriginal = globalThis.document;
    // @ts-expect-error — simula ambiente sem DOM
    globalThis.document = undefined;
    expect(tokenCor("danger")).toBe("");
    globalThis.document = docOriginal;
  });
});
