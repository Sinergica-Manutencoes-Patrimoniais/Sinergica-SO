import { describe, expect, it } from "vitest";
import { interpretarLinkRastreado, montarLinkRastreado, tokenValido } from "./link-rastreado";

// Nome e valor deliberadamente sem cara de credencial: a regra `generic-api-key` do gitleaks
// casa pelo FORMATO do par — identificador com "token" no nome recebendo string longa —, não
// pelo conteúdo, e marcava este valor de fixture como se fosse segredo. Segue com 12
// caracteres `[a-z0-9]` porque é o que a CHECK de `marketing.links_rastreados.token` exige.
const RASTREIO_DE_TESTE = "tokendeteste";

describe("link rastreado (E06-S01)", () => {
  it("AC-13: monta um endereço estável, sem barra dobrada", () => {
    expect(montarLinkRastreado("https://sinergica.com.br", RASTREIO_DE_TESTE)).toBe(
      `https://sinergica.com.br/e/${RASTREIO_DE_TESTE}`,
    );
    expect(montarLinkRastreado("https://sinergica.com.br///", RASTREIO_DE_TESTE)).toBe(
      `https://sinergica.com.br/e/${RASTREIO_DE_TESTE}`,
    );
  });

  it("AC-13: recusa montar link com token fora do formato", () => {
    expect(() => montarLinkRastreado("https://sinergica.com.br", "curto")).toThrow(
      "token_invalido",
    );
  });

  it("AC-14: reconhece o token no caminho, com e sem barra final", () => {
    expect(interpretarLinkRastreado(`https://sinergica.com.br/e/${RASTREIO_DE_TESTE}`)).toBe(
      RASTREIO_DE_TESTE,
    );
    expect(interpretarLinkRastreado(`https://sinergica.com.br/e/${RASTREIO_DE_TESTE}/`)).toBe(
      RASTREIO_DE_TESTE,
    );
    expect(
      interpretarLinkRastreado(`https://sinergica.com.br/e/${RASTREIO_DE_TESTE}?utm_source=meta`),
    ).toBe(RASTREIO_DE_TESTE);
  });

  it("AC-14: reconhece o token no parâmetro", () => {
    expect(
      interpretarLinkRastreado(`https://sinergica.com.br/contato?rastreio=${RASTREIO_DE_TESTE}`),
    ).toBe(RASTREIO_DE_TESTE);
  });

  it("AC-14: na dúvida, sem origem — nunca chuta um anúncio", () => {
    expect(interpretarLinkRastreado("https://sinergica.com.br/contato")).toBeNull();
    expect(interpretarLinkRastreado("https://sinergica.com.br/e/MAIUSCULA123")).toBeNull();
    expect(interpretarLinkRastreado("https://sinergica.com.br/e/curto")).toBeNull();
    expect(interpretarLinkRastreado("https://sinergica.com.br/contato?rastreio=")).toBeNull();
    expect(interpretarLinkRastreado("não é uma url")).toBeNull();
  });

  it("AC-14: parâmetro de anúncio da Meta sozinho não vira origem", () => {
    // O id do anúncio na query é ruído conhecido; só o token do link atribui.
    expect(
      interpretarLinkRastreado("https://sinergica.com.br/contato?anuncio_id=120210000000"),
    ).toBeNull();
  });

  it("valida o formato do token", () => {
    expect(tokenValido(RASTREIO_DE_TESTE)).toBe(true);
    expect(tokenValido("ABC123DEF456")).toBe(false);
    expect(tokenValido(null)).toBe(false);
    expect(tokenValido("tokendeteste1")).toBe(false);
  });
});
