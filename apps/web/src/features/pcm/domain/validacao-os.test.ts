import { describe, expect, it } from "vitest";
import {
  classificacaoCompleta,
  geraPendenciaTecnica,
  perguntasNaoRespondidas,
  respostaValida,
} from "./validacao-os";

describe("validação de retorno de campo (AC-8)", () => {
  it("exige observação quando o resultado é não_aplicavel", () => {
    expect(respostaValida({ perguntaId: "p1", resultado: "nao_aplicavel", observacao: null })).toBe(
      false,
    );
    expect(
      respostaValida({ perguntaId: "p1", resultado: "nao_aplicavel", observacao: "   " }),
    ).toBe(false);
    expect(
      respostaValida({
        perguntaId: "p1",
        resultado: "nao_aplicavel",
        observacao: "sem acesso ao local",
      }),
    ).toBe(true);
  });

  it("não exige observação pros outros resultados", () => {
    expect(respostaValida({ perguntaId: "p1", resultado: "ok", observacao: null })).toBe(true);
    expect(
      respostaValida({ perguntaId: "p1", resultado: "nao_inspecionado", observacao: null }),
    ).toBe(true);
  });

  it("recusa observação acima de 4000 caracteres (mesmo limite do servidor)", () => {
    expect(
      respostaValida({ perguntaId: "p1", resultado: "ok", observacao: "x".repeat(4001) }),
    ).toBe(false);
  });

  it("aponta perguntas obrigatórias ainda sem resposta", () => {
    const perguntas = [
      { id: "p1", texto: "Disjuntor íntegro?" },
      { id: "p2", texto: "Fiação sem oxidação?" },
    ];
    expect(
      perguntasNaoRespondidas(perguntas, [{ perguntaId: "p1", resultado: "ok", observacao: null }]),
    ).toEqual(["p2"]);
    expect(
      classificacaoCompleta(perguntas, [{ perguntaId: "p1", resultado: "ok", observacao: null }]),
    ).toBe(false);
  });

  it("classificação completa quando toda pergunta tem resposta", () => {
    const perguntas = [
      { id: "p1", texto: null },
      { id: "p2", texto: null },
    ];
    const respostas = [
      { perguntaId: "p1", resultado: "ok" as const, observacao: null },
      { perguntaId: "p2", resultado: "nao_inspecionado" as const, observacao: null },
    ];
    expect(classificacaoCompleta(perguntas, respostas)).toBe(true);
    expect(perguntasNaoRespondidas(perguntas, respostas)).toEqual([]);
  });

  it("só não_ok sugere Pendência Técnica — opcional não inspecionada nunca gera (prévia da regra do servidor)", () => {
    expect(geraPendenciaTecnica({ perguntaId: "p1", resultado: "nao_ok", observacao: null })).toBe(
      true,
    );
    expect(
      geraPendenciaTecnica({ perguntaId: "p1", resultado: "nao_inspecionado", observacao: null }),
    ).toBe(false);
    expect(geraPendenciaTecnica({ perguntaId: "p1", resultado: "ok", observacao: null })).toBe(
      false,
    );
  });
});
