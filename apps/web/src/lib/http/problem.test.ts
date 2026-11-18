import { describe, expect, it } from "vitest";
import { causaErroRpc, mensagemErroRpc, problem } from "./problem";

describe("problem", () => {
  it("usa título estável por status e omite detail/reqId ausentes", () => {
    expect(problem(404)).toEqual({ type: "about:blank", title: "Not Found", status: 404 });
  });

  it("inclui detail e reqId quando fornecidos", () => {
    expect(problem(409, "conflito de revisão", { reqId: "abc-123" })).toEqual({
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "conflito de revisão",
      reqId: "abc-123",
    });
  });
});

describe("causaErroRpc — E00-S28 AC-7", () => {
  it("42501 é falta de permissão", () => {
    expect(causaErroRpc("42501")).toBe("permissao");
  });

  it("55000 é recurso não ativado (gate fechado)", () => {
    expect(causaErroRpc("55000")).toBe("nao_ativado");
  });

  it("qualquer outro código, ou ausência de código, cai em 'outro'", () => {
    expect(causaErroRpc("23502")).toBe("outro");
    expect(causaErroRpc(undefined)).toBe("outro");
    expect(causaErroRpc(null)).toBe("outro");
  });
});

describe("mensagemErroRpc — E00-S28 AC-7", () => {
  it("distingue a mensagem de permissão da de recurso não ativado", () => {
    const permissao = mensagemErroRpc("42501");
    const naoAtivado = mensagemErroRpc("55000");
    expect(permissao).not.toBe(naoAtivado);
    expect(permissao).toMatch(/permissão/i);
    expect(naoAtivado).toMatch(/não está ativado/i);
  });

  it("nunca expõe código ou detalhe interno na mensagem", () => {
    for (const codigo of ["42501", "55000", "23502", undefined]) {
      const mensagem = mensagemErroRpc(codigo);
      expect(mensagem).not.toMatch(/4250|5500|2350/);
    }
  });
});
