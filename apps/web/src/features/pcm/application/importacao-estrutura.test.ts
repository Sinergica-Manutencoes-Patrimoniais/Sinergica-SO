import { describe, expect, it, vi } from "vitest";
import { executarPlanoImportacao } from "./importacao-estrutura";

describe("executarPlanoImportacao", () => {
  it("executa sequencialmente e pula dependente de falha", async () => {
    const executar = vi.fn(async (resultado: { linha: { numero: number } }) => {
      if (resultado.linha.numero === 1) throw new Error("falhou");
    });
    const plano = {
      temErros: false,
      alteracoes: 2,
      resultados: [
        { linha: { numero: 1 }, resultado: "CRIAR", detalhes: [], dependeDe: [] },
        { linha: { numero: 2 }, resultado: "CRIAR", detalhes: [], dependeDe: [1] },
      ],
    } as never;
    const relatorio = await executarPlanoImportacao(plano, executar, vi.fn());
    expect(executar).toHaveBeenCalledTimes(1);
    expect(relatorio.map((linha) => linha.status)).toEqual(["FALHOU", "PULADA"]);
  });
});
