import { describe, expect, it } from "vitest";
import {
  avaliarRespostasPreventivas,
  preverPendenciasDeRetornoValidado,
} from "./pendencias-tecnicas";

describe("prévia de respostas preventivas", () => {
  it("distingue Não OK, Corrigido, Não aplicável e ausência obrigatória", () => {
    const resultado = avaliarRespostasPreventivas([
      { perguntaId: "a", obrigatoria: true, resposta: "nao_ok", justificativa: null },
      { perguntaId: "b", obrigatoria: true, resposta: "nao_ok", justificativa: null },
      { perguntaId: "c", obrigatoria: true, resposta: "nao_ok", justificativa: null },
      { perguntaId: "d", obrigatoria: true, resposta: "corrigido", justificativa: null },
      {
        perguntaId: "e",
        obrigatoria: true,
        resposta: "nao_aplicavel",
        justificativa: "Sem equipamento",
      },
      { perguntaId: "f", obrigatoria: true, resposta: null, justificativa: null },
    ]);
    expect(resultado).toEqual({
      candidatosNaoOk: ["a", "b", "c"],
      corrigidos: ["d"],
      ausentesObrigatorios: ["f"],
      naoAplicaveisSemJustificativa: [],
      completa: false,
    });
  });
  it("permite análise PCM completa com Não OK e sem ausência obrigatória", () => {
    expect(
      avaliarRespostasPreventivas([
        { perguntaId: "a", obrigatoria: true, resposta: "nao_ok", justificativa: null },
        { perguntaId: "b", obrigatoria: false, resposta: null, justificativa: null },
      ]),
    ).toEqual({
      candidatosNaoOk: ["a"],
      corrigidos: [],
      ausentesObrigatorios: [],
      naoAplicaveisSemJustificativa: [],
      completa: true,
    });
  });
  it("exige justificativa de Não aplicável inclusive se a pergunta é opcional", () => {
    expect(
      avaliarRespostasPreventivas([
        { perguntaId: "a", obrigatoria: false, resposta: "nao_aplicavel", justificativa: "  " },
      ]),
    ).toEqual({
      candidatosNaoOk: [],
      corrigidos: [],
      ausentesObrigatorios: [],
      naoAplicaveisSemJustificativa: ["a"],
      completa: false,
    });
  });
  it("recusa perguntas duplicadas e respostas não reconhecidas", () => {
    const resposta = {
      perguntaId: "a",
      obrigatoria: true,
      resposta: "ok" as const,
      justificativa: null,
    };
    expect(() => avaliarRespostasPreventivas([resposta, resposta])).toThrow();
    expect(() =>
      avaliarRespostasPreventivas([{ ...resposta, resposta: "texto livre" as never }]),
    ).toThrow();
    expect(() => avaliarRespostasPreventivas([{ ...resposta, perguntaId: " " }])).toThrow();
  });
  it("não considera ausência de questionário prova de execução completa", () => {
    expect(avaliarRespostasPreventivas([]).completa).toBe(false);
  });
});

describe("prévia de retorno explicitamente validado", () => {
  it("mantém origem, alvo e pergunta por candidato, sem criar Pendência para corrigido", () => {
    const resultado = preverPendenciasDeRetornoValidado({
      estado: "validada",
      clienteId: "cliente",
      osId: "os",
      ocorrenciaId: "ocorrencia",
      alvoId: "alvo",
      validacaoId: "validacao",
      respostas: [
        { perguntaId: "a", obrigatoria: true, resposta: "nao_ok", justificativa: null },
        { perguntaId: "b", obrigatoria: true, resposta: "corrigido", justificativa: null },
      ],
    });
    expect(resultado.candidatos).toEqual([
      {
        clienteId: "cliente",
        osId: "os",
        ocorrenciaId: "ocorrencia",
        alvoId: "alvo",
        validacaoId: "validacao",
        perguntaId: "a",
      },
    ]);
    expect(resultado.corrigidos).toEqual(["b"]);
  });
  it("não prepara candidatos para retorno não validado ou com resposta obrigatória ausente", () => {
    const entrada = {
      estado: "pendente" as const,
      clienteId: "cliente",
      osId: "os",
      ocorrenciaId: "ocorrencia",
      alvoId: "alvo",
      validacaoId: "validacao",
      respostas: [
        { perguntaId: "a", obrigatoria: true, resposta: "nao_ok" as const, justificativa: null },
      ],
    };
    expect(() => preverPendenciasDeRetornoValidado(entrada)).toThrow();
    expect(() =>
      preverPendenciasDeRetornoValidado({
        ...entrada,
        estado: "validada",
        respostas: [
          ...entrada.respostas,
          { perguntaId: "b", obrigatoria: true, resposta: null, justificativa: null },
        ],
      }),
    ).toThrow();
    expect(() =>
      preverPendenciasDeRetornoValidado({ ...entrada, estado: "validada", alvoId: " " }),
    ).toThrow();
  });
  it("recusa resposta duplicada e Não aplicável sem justificativa", () => {
    const resposta = {
      perguntaId: "a",
      obrigatoria: true,
      resposta: "nao_ok" as const,
      justificativa: null,
    };
    const base = {
      estado: "validada" as const,
      clienteId: "cliente",
      osId: "os",
      ocorrenciaId: "ocorrencia",
      alvoId: "alvo",
      validacaoId: "validacao",
      respostas: [resposta],
    };
    expect(() =>
      preverPendenciasDeRetornoValidado({ ...base, respostas: [resposta, resposta] }),
    ).toThrow();
    expect(() =>
      preverPendenciasDeRetornoValidado({
        ...base,
        respostas: [{ ...resposta, resposta: "nao_aplicavel", justificativa: " " }],
      }),
    ).toThrow();
  });
});
