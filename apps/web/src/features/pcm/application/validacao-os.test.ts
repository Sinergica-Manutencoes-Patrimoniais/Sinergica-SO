import { describe, expect, it, vi } from "vitest";
import { criarOperacoesValidacaoOs } from "./validacao-os";

function armazenamentoMemoria() {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
    removeItem: (chave: string) => void dados.delete(chave),
  };
}

const clienteId = "16800000-0000-4000-8000-000000000002";
const retornoId = "16800000-0000-4000-8000-000000000038";
const usuarioId = "16800000-0000-4000-8000-000000000001";
const contexto = { usuarioId, clienteId, retornoId };

describe("criarOperacoesValidacaoOs", () => {
  it("classifica, fica sem pendência após sucesso, e chama a RPC uma única vez", async () => {
    const classificarRetorno = vi
      .fn()
      .mockResolvedValue({ requestId: "r1", retornoId, coberturaComprovada: false });
    const operacoes = criarOperacoesValidacaoOs(
      { classificarRetorno },
      armazenamentoMemoria(),
      contexto,
    );
    expect(operacoes.pendente()).toBeNull();
    const resultado = await operacoes.iniciar({
      tipo: "classificar",
      comando: {
        requestId: "17100000-0000-4000-8000-000000000031",
        clienteId,
        envelopeId: retornoId,
        resolucaoId: retornoId,
        retornoId,
        respostas: [{ perguntaId: "p1", resultado: "ok", observacao: null }],
      },
    });
    expect(resultado).toEqual({ requestId: "r1", retornoId, coberturaComprovada: false });
    expect(classificarRetorno).toHaveBeenCalledTimes(1);
    expect(operacoes.pendente()).toBeNull();
  });

  it("recusa observação ausente quando o resultado é não_aplicavel", async () => {
    const classificarRetorno = vi.fn();
    const operacoes = criarOperacoesValidacaoOs(
      { classificarRetorno },
      armazenamentoMemoria(),
      contexto,
    );
    await expect(
      operacoes.iniciar({
        tipo: "classificar",
        comando: {
          requestId: "17100000-0000-4000-8000-000000000031",
          clienteId,
          envelopeId: retornoId,
          resolucaoId: retornoId,
          retornoId,
          respostas: [{ perguntaId: "p1", resultado: "nao_aplicavel", observacao: null }],
        },
      }),
    ).rejects.toThrow();
    expect(classificarRetorno).not.toHaveBeenCalled();
  });

  it("recusa pergunta respondida mais de uma vez", async () => {
    const classificarRetorno = vi.fn();
    const operacoes = criarOperacoesValidacaoOs(
      { classificarRetorno },
      armazenamentoMemoria(),
      contexto,
    );
    await expect(
      operacoes.iniciar({
        tipo: "classificar",
        comando: {
          requestId: "17100000-0000-4000-8000-000000000031",
          clienteId,
          envelopeId: retornoId,
          resolucaoId: retornoId,
          retornoId,
          respostas: [
            { perguntaId: "p1", resultado: "ok", observacao: null },
            { perguntaId: "p1", resultado: "nao_ok", observacao: null },
          ],
        },
      }),
    ).rejects.toThrow();
    expect(classificarRetorno).not.toHaveBeenCalled();
  });

  it("recusa Cliente divergente do contexto antes de chamar a RPC", async () => {
    const conferirCoberturaRetorno = vi.fn();
    const operacoes = criarOperacoesValidacaoOs(
      { conferirCoberturaRetorno },
      armazenamentoMemoria(),
      contexto,
    );
    await expect(
      operacoes.iniciar({
        tipo: "conferirCobertura",
        comando: {
          requestId: "17100000-0000-4000-8000-000000000032",
          clienteId: "16800000-0000-4000-8000-000000000099",
          retornoId,
          evidenciaId: null,
          expectedEvidencias: 0,
          justificativa: "Conferência",
        },
      }),
    ).rejects.toThrow("Cliente divergente.");
    expect(conferirCoberturaRetorno).not.toHaveBeenCalled();
  });

  it("recusa retorno divergente do contexto antes de chamar a RPC", async () => {
    const aprovarFinalizarOs = vi.fn();
    const operacoes = criarOperacoesValidacaoOs(
      { aprovarFinalizarOs },
      armazenamentoMemoria(),
      contexto,
    );
    await expect(
      operacoes.iniciar({
        tipo: "aprovarFinalizar",
        comando: {
          requestId: "17100000-0000-4000-8000-000000000033",
          clienteId,
          retornoId: "16800000-0000-4000-8000-000000000099",
          conferenciaId: "17100000-0000-4000-8000-000000000034",
          expectedEvidencias: 0,
          expectedDecisao: 0,
          justificativa: "Aprovação",
          expectedOsId: "16800000-0000-4000-8000-000000000017",
          expectedStatus: "em_execucao",
          expectedUpdatedAt: "2026-11-01T10:00:00Z",
        },
      }),
    ).rejects.toThrow("Retorno divergente.");
    expect(aprovarFinalizarOs).not.toHaveBeenCalled();
  });

  it("mantém a tentativa pendente em erro incerto, e permite repetir exatamente a mesma chamada", async () => {
    const aprovarFinalizarOs = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        requestId: "r2",
        retornoId,
        osId: "16800000-0000-4000-8000-000000000017",
        revision: 2,
        pendenciasProcessadas: 0,
        osEncerrada: true,
        chamadoAlterado: false,
        conteudoAutenticado: false,
      });
    const armazenamento = armazenamentoMemoria();
    const operacoes = criarOperacoesValidacaoOs({ aprovarFinalizarOs }, armazenamento, contexto);
    const comando = {
      tipo: "aprovarFinalizar" as const,
      comando: {
        requestId: "17100000-0000-4000-8000-000000000035",
        clienteId,
        retornoId,
        conferenciaId: "17100000-0000-4000-8000-000000000034",
        expectedEvidencias: 0,
        expectedDecisao: 1,
        justificativa: "Aprovação",
        expectedOsId: "16800000-0000-4000-8000-000000000017",
        expectedStatus: "em_execucao",
        expectedUpdatedAt: "2026-11-01T10:00:00Z",
      },
    };
    await expect(operacoes.iniciar(comando)).rejects.toThrow("timeout");
    expect(operacoes.pendente()).not.toBeNull();
    await expect(operacoes.repetir()).resolves.toMatchObject({ osEncerrada: true });
    expect(operacoes.pendente()).toBeNull();
    expect(aprovarFinalizarOs).toHaveBeenCalledTimes(2);
    expect(aprovarFinalizarOs).toHaveBeenNthCalledWith(2, comando.comando);
  });

  it("limpa a tentativa pendente quando o servidor confirma erro definitivo (nunca repete às cegas)", async () => {
    const erroDefinitivo = Object.assign(new Error("revisão obsoleta"), { code: "40001" });
    const conferirCoberturaRetorno = vi.fn().mockRejectedValueOnce(erroDefinitivo);
    const operacoes = criarOperacoesValidacaoOs(
      { conferirCoberturaRetorno },
      armazenamentoMemoria(),
      contexto,
    );
    await expect(
      operacoes.iniciar({
        tipo: "conferirCobertura",
        comando: {
          requestId: "17100000-0000-4000-8000-000000000036",
          clienteId,
          retornoId,
          evidenciaId: null,
          expectedEvidencias: 0,
          justificativa: "Conferência",
        },
      }),
    ).rejects.toThrow("revisão obsoleta");
    expect(operacoes.pendente()).toBeNull();
  });

  it("não deixa iniciar nova operação enquanto houver uma pendente", async () => {
    const conferirCoberturaRetorno = vi.fn().mockRejectedValue(new Error("timeout"));
    const operacoes = criarOperacoesValidacaoOs(
      { conferirCoberturaRetorno },
      armazenamentoMemoria(),
      contexto,
    );
    const comando = {
      tipo: "conferirCobertura" as const,
      comando: {
        requestId: "17100000-0000-4000-8000-000000000037",
        clienteId,
        retornoId,
        evidenciaId: null,
        expectedEvidencias: 0,
        justificativa: "Conferência",
      },
    };
    await expect(operacoes.iniciar(comando)).rejects.toThrow("timeout");
    await expect(operacoes.iniciar(comando)).rejects.toThrow(
      "Resolva a operação pendente antes de continuar.",
    );
  });
});
