import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { focarPrimeiroInvalido, useValidacaoCampo } from "./use-validacao-campo";

const schemaEmail = z.string().email("Informe um e-mail válido");

describe("useValidacaoCampo — E00-S15 AC-8", () => {
  it("não acusa erro antes do primeiro blur", () => {
    const { result } = renderHook(() => useValidacaoCampo(schemaEmail));
    act(() => result.current.aoDigitar("nao-e-email"));
    expect(result.current.erro).toBeNull();
  });

  it("aoSair (blur) com valor inválido acusa erro", () => {
    const { result } = renderHook(() => useValidacaoCampo(schemaEmail));
    act(() => result.current.aoSair("nao-e-email"));
    expect(result.current.erro).toBe("Informe um e-mail válido");
  });

  it("depois de tocado, digitar um valor válido limpa o erro", () => {
    const { result } = renderHook(() => useValidacaoCampo(schemaEmail));
    act(() => result.current.aoSair("nao-e-email"));
    expect(result.current.erro).not.toBeNull();
    act(() => result.current.aoDigitar("ok@exemplo.com"));
    expect(result.current.erro).toBeNull();
  });

  it("depois de tocado, digitar outro valor inválido não muda a mensagem (só limpa quando fica válido)", () => {
    const { result } = renderHook(() => useValidacaoCampo(schemaEmail));
    act(() => result.current.aoSair("a"));
    const mensagem = result.current.erro;
    act(() => result.current.aoDigitar("ab"));
    expect(result.current.erro).toBe(mensagem);
  });

  it("validar() força tocado e devolve se é válido", () => {
    const { result } = renderHook(() => useValidacaoCampo(schemaEmail));
    let valido = true;
    act(() => {
      valido = result.current.validar("nao-e-email");
    });
    expect(valido).toBe(false);
    expect(result.current.erro).toBe("Informe um e-mail válido");
  });
});

describe("focarPrimeiroInvalido — E00-S15 AC-8", () => {
  it("foca o primeiro elemento com aria-invalid=true dentro do form", () => {
    document.body.innerHTML = `
      <form id="f">
        <input aria-invalid="false" />
        <input id="ruim" aria-invalid="true" />
      </form>
    `;
    const form = document.getElementById("f") as HTMLFormElement;
    const achou = focarPrimeiroInvalido(form);
    expect(achou).toBe(true);
    expect(document.activeElement?.id).toBe("ruim");
  });

  it("sem campo inválido, devolve false", () => {
    document.body.innerHTML = `<form id="f"><input aria-invalid="false" /></form>`;
    const form = document.getElementById("f") as HTMLFormElement;
    expect(focarPrimeiroInvalido(form)).toBe(false);
  });
});
