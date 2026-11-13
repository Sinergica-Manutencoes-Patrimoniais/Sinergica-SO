// E01-S189 (AC-5) — a distinção entre "não liberado" e "sem permissão" não pode regredir para
// um "não reconhecido" silencioso: um erro desconhecido tem que devolver null, nunca mascarar
// como um dos dois casos conhecidos.
import { describe, expect, it } from "vitest";
import { TEXTO_FALHA_ATIVACAO, mensagemFalhaAtivacao } from "./mensagem-ativacao";

describe("mensagemFalhaAtivacao", () => {
  it("reconhece 55000 (gate fechado) como indisponivel", () => {
    expect(mensagemFalhaAtivacao({ code: "55000" })).toBe("indisponivel");
  });
  it("reconhece 42501 (sem autorização) como sem_permissao", () => {
    expect(mensagemFalhaAtivacao({ code: "42501" })).toBe("sem_permissao");
  });
  it("não reconhece outros códigos — não pode mascarar erro desconhecido", () => {
    expect(mensagemFalhaAtivacao({ code: "40001" })).toBeNull();
    expect(mensagemFalhaAtivacao(new Error("falha de rede"))).toBeNull();
    expect(mensagemFalhaAtivacao(null)).toBeNull();
    expect(mensagemFalhaAtivacao(undefined)).toBeNull();
  });
  it("as duas mensagens são distintas uma da outra", () => {
    expect(TEXTO_FALHA_ATIVACAO.indisponivel).not.toBe(TEXTO_FALHA_ATIVACAO.sem_permissao);
  });
});
