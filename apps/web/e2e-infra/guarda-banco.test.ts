import { describe, expect, it } from "vitest";
import { BancoE2ERecusado, PROJECT_REF_PRODUCAO, verificarBancoE2E } from "./guarda-banco";

function jwtComRef(ref: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64({ ref, role: "anon" })}.assinatura`;
}

describe("verificarBancoE2E (E00-S31 / SEC-006)", () => {
  it("aceita Supabase local", () => {
    expect(() => verificarBancoE2E({ url: "http://127.0.0.1:55321" })).not.toThrow();
    expect(() => verificarBancoE2E({ url: "http://localhost:54321" })).not.toThrow();
  });

  it("recusa URL ausente", () => {
    expect(() => verificarBancoE2E({ url: undefined })).toThrow(BancoE2ERecusado);
  });

  it("recusa a URL de produção", () => {
    expect(() => verificarBancoE2E({ url: `https://${PROJECT_REF_PRODUCAO}.supabase.co` })).toThrow(
      /PRODUÇÃO/,
    );
  });

  it("recusa produção mesmo se listada como permitida", () => {
    expect(() =>
      verificarBancoE2E({
        url: `https://${PROJECT_REF_PRODUCAO}.supabase.co`,
        refsPermitidos: PROJECT_REF_PRODUCAO,
      }),
    ).toThrow(/PRODUÇÃO/);
  });

  it("recusa URL local com a chave anon de produção", () => {
    expect(() =>
      verificarBancoE2E({
        url: "http://127.0.0.1:55321",
        chaveAnon: jwtComRef(PROJECT_REF_PRODUCAO),
      }),
    ).toThrow(/chave/);
  });

  it("recusa projeto remoto não listado e aceita o listado", () => {
    const ref = "abcdefghijklmnopqrst";
    expect(() => verificarBancoE2E({ url: `https://${ref}.supabase.co` })).toThrow(/não está/);
    expect(() =>
      verificarBancoE2E({ url: `https://${ref}.supabase.co`, refsPermitidos: ref }),
    ).not.toThrow();
  });

  it("recusa host arbitrário", () => {
    expect(() => verificarBancoE2E({ url: "https://proxy.exemplo.com" })).toThrow(/não é local/);
  });
});
