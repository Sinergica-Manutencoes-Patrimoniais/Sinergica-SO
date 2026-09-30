import { describe, expect, it, vi } from "vitest";
import { executarPlanoEstrutura, executarPlanoImportacao } from "./importacao-estrutura";

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

  it("nunca inicia duas gravações em paralelo", async () => {
    let emVoo = 0;
    let maximo = 0;
    const plano = {
      temErros: false,
      alteracoes: 2,
      resumo: {},
      resultados: [
        { linha: { numero: 1 }, resultado: "CRIAR", detalhes: [], dependeDe: [] },
        { linha: { numero: 2 }, resultado: "CRIAR", detalhes: [], dependeDe: [] },
      ],
    } as never;
    await executarPlanoImportacao(
      plano,
      async () => {
        emVoo += 1;
        maximo = Math.max(maximo, emVoo);
        await Promise.resolve();
        emVoo -= 1;
      },
      vi.fn(),
    );
    expect(maximo).toBe(1);
  });

  it("executa criação de Área pelos casos de uso e devolve relatório", async () => {
    const criarArea = vi.fn(async (input: { nome: string }) => ({
      id: "a-nova",
      nome: input.nome,
    }));
    const plano = {
      temErros: false,
      alteracoes: 1,
      resumo: {},
      resultados: [
        {
          linha: {
            aba: "Áreas",
            numero: 2,
            acao: "CRIAR",
            valores: { Nome: "Torre", Sigla: "TOR", Ordem: "1" },
          },
          valoresExecutar: { Nome: "Torre", Sigla: "TOR", Ordem: "1" },
          resultado: "CRIAR",
          detalhes: [],
          dependeDe: [],
        },
      ],
    } as never;
    const estado = {
      cliente: { id: "cliente", nome: "Cliente", sigla: "CLI" },
      areas: [],
      locais: [],
      sistemas: [],
      componentes: [],
      membros: [],
      categorias: [],
      tiposLocal: [],
    };
    const relatorio = await executarPlanoEstrutura(
      plano,
      estado,
      {
        hierarquia: { criarArea } as never,
        equipamentos: {} as never,
        sistemas: {} as never,
        identificador: {} as never,
      },
      "usuario",
      vi.fn(),
    );
    expect(criarArea).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Torre", sigla: "TOR" }),
    );
    expect(relatorio).toEqual([{ numero: 2, status: "OK", mensagem: "Aplicada." }]);
  });
});
