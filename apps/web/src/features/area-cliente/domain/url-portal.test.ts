import { describe, expect, it } from "vitest";
import { resolverUrlPortal, usaDeploySeparado } from "./url-portal";

describe("URL do Portal do Cliente", () => {
  const origem = "https://so-sinergica.netlify.app";

  it("usa deploy separado quando configurado", () => {
    expect(resolverUrlPortal(" https://portal.sinergica.com.br ", origem)).toBe(
      "https://portal.sinergica.com.br",
    );
    expect(usaDeploySeparado("https://portal.sinergica.com.br", origem)).toBe(true);
  });

  it("mantém acesso da fase 1 no endereço atual enquanto deploy separado não existe", () => {
    expect(resolverUrlPortal(undefined, origem)).toBe(origem);
    expect(usaDeploySeparado(undefined, origem)).toBe(false);
  });
});
