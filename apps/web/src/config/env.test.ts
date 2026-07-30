import { describe, expect, it } from "vitest";
import { carregarEnv } from "./env";

const BASE_VALID = {
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "anon-key-example",
};

describe("carregarEnv", () => {
  it("aplica default de NODE_ENV e aceita config válida", () => {
    const env = carregarEnv({
      ...BASE_VALID,
      VITE_PORTAL_URL: "https://portal.sinergica.com.br",
    });
    expect(env.NODE_ENV).toBe("development");
    expect(env.VITE_SUPABASE_URL).toBe("https://project.supabase.co");
    expect(env.VITE_SUPABASE_ANON_KEY).toBe("anon-key-example");
    expect(env.VITE_PORTAL_URL).toBe("https://portal.sinergica.com.br");
  });

  it("falha (fail-fast) com mensagem legível quando a URL é inválida", () => {
    expect(() => carregarEnv({ ...BASE_VALID, VITE_SUPABASE_URL: "nao-e-url" })).toThrow(
      /ambiente inválida/i,
    );
  });

  it("falha quando VITE_SUPABASE_URL está ausente", () => {
    expect(() => carregarEnv({ VITE_SUPABASE_ANON_KEY: "key" })).toThrow(/ambiente inválida/i);
  });
});
