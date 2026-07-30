import { describe, expect, it } from "vitest";
import { erroDetalhado } from "./edge-function-error";

describe("erroDetalhado", () => {
  it("extrai o detail do corpo problem+json em error.context", async () => {
    const contexto = new Response(
      JSON.stringify({ type: "about:blank", status: 502, detail: "OpenRouter respondeu 429" }),
    );
    const erro = await erroDetalhado({
      message: "Edge Function returned a non-2xx status code",
      context: contexto,
    });
    expect(erro.message).toBe("OpenRouter respondeu 429");
  });

  it("cai no erro original quando o corpo não é JSON", async () => {
    const contexto = new Response("not json");
    const original = new Error("Edge Function returned a non-2xx status code");
    const erro = await erroDetalhado(Object.assign(original, { context: contexto }));
    expect(erro.message).toBe("Edge Function returned a non-2xx status code");
  });

  it("cai no erro original quando não há context", async () => {
    const original = new Error("Failed to send a request to the Edge Function");
    const erro = await erroDetalhado(original);
    expect(erro).toBe(original);
  });

  it("envolve valores não-Error sem context", async () => {
    const erro = await erroDetalhado("algo deu errado");
    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toBe("algo deu errado");
  });
});
