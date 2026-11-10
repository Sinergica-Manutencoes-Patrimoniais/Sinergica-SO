import { describe, expect, it, vi } from "vitest";
import { planejarImportacao } from "../domain/importacao-estrutura";
import { executarPlanoEstrutura, executarPlanoImportacao } from "./importacao-estrutura";

describe("executarPlanoImportacao", () => {
  it("bloqueia Sistema quando Área criada anteriormente falha", async () => {
    const plano = planejarImportacao(
      [
        { aba: "Áreas", numero: 2, acao: "CRIAR", valores: { Nome: "Nova", Sigla: "NOV" } },
        {
          aba: "Sistemas",
          numero: 3,
          acao: "CRIAR",
          valores: { Nome: "Hidrantes", Categoria: "PCI", Área: "Nova" },
        },
      ],
      {
        cliente: { id: "c", nome: "Cliente" },
        areas: [],
        locais: [],
        sistemas: [],
        componentes: [],
        membros: [],
        categorias: [{ id: "cat", nome: "PCI" }],
        tiposLocal: [],
      },
    );
    expect(plano.temErros).toBe(false);
    const executadas: string[] = [];
    const relatorio = await executarPlanoImportacao(
      plano,
      async ({ linha }) => {
        executadas.push(linha.aba);
        if (linha.aba === "Áreas") throw new Error("falhou");
      },
      () => {},
    );
    expect(executadas).toEqual(["Áreas"]);
    expect(relatorio.map(({ status }) => status)).toEqual(["FALHOU", "PULADA"]);
  });
  it("propaga falha usando referências reais da prévia, sem confundir abas", async () => {
    const plano = planejarImportacao(
      [
        { aba: "Áreas", numero: 2, acao: "CRIAR", valores: { Nome: "Nova", Sigla: "NOV" } },
        {
          aba: "Locais",
          numero: 3,
          acao: "CRIAR",
          valores: { Área: "Nova", Nome: "Raiz", Sigla: "RAI" },
        },
        {
          aba: "Locais",
          numero: 4,
          acao: "CRIAR",
          valores: { Área: "Nova", "Local pai": "Raiz", Nome: "Filho", Sigla: "FIL" },
        },
        {
          aba: "Sistemas",
          numero: 2,
          acao: "CRIAR",
          valores: { Nome: "Hidrantes", Categoria: "PCI" },
        },
        {
          aba: "Componentes",
          numero: 5,
          acao: "CRIAR",
          valores: { Nome: "Bomba", Categoria: "PCI", Sistema: "Hidrantes" },
        },
      ],
      {
        cliente: { id: "c", nome: "Cliente" },
        areas: [],
        locais: [],
        sistemas: [],
        componentes: [],
        membros: [],
        categorias: [{ id: "cat", nome: "PCI" }],
        tiposLocal: [],
      },
    );
    expect(plano.temErros).toBe(false);
    const executadas: string[] = [];
    const relatorio = await executarPlanoImportacao(
      plano,
      async ({ linha }) => {
        executadas.push(`${linha.aba}:${linha.numero}`);
        if (linha.aba === "Áreas") throw new Error("falhou");
      },
      () => {},
    );
    expect(executadas).toEqual(["Áreas:2", "Sistemas:2", "Componentes:5"]);
    expect(relatorio.map(({ status }) => status)).toEqual([
      "FALHOU",
      "PULADA",
      "PULADA",
      "OK",
      "OK",
    ]);
    expect(relatorio.map(({ aba, numero }) => `${aba}:${numero}`)).toEqual([
      "Áreas:2",
      "Locais:3",
      "Locais:4",
      "Sistemas:2",
      "Componentes:5",
    ]);
  });
  it("bloqueia descendentes transitivos após falha na área", async () => {
    const executadas: string[] = [];
    const plano = {
      resultados: [
        { linha: { aba: "Áreas", numero: 2 }, resultado: "CRIAR", dependeDe: [] },
        { linha: { aba: "Locais", numero: 3 }, resultado: "CRIAR", dependeDe: ["Áreas:2"] },
        { linha: { aba: "Locais", numero: 4 }, resultado: "CRIAR", dependeDe: ["Locais:3"] },
      ],
    } as never;
    const relatorio = await executarPlanoImportacao(
      plano,
      async (resultado) => {
        executadas.push(`${resultado.linha.aba}:${resultado.linha.numero}`);
        if (resultado.linha.aba === "Áreas") throw new Error("falhou");
      },
      () => {},
    );
    expect(executadas).toEqual(["Áreas:2"]);
    expect(relatorio.map((linha) => linha.status)).toEqual(["FALHOU", "PULADA", "PULADA"]);
  });

  it("não confunde falha de linha homônima em outra aba", async () => {
    const plano = {
      resultados: [
        { linha: { aba: "Áreas", numero: 2 }, resultado: "CRIAR", dependeDe: [] },
        { linha: { aba: "Sistemas", numero: 2 }, resultado: "CRIAR", dependeDe: [] },
        { linha: { aba: "Componentes", numero: 3 }, resultado: "CRIAR", dependeDe: ["Sistemas:2"] },
      ],
    } as never;
    const relatorio = await executarPlanoImportacao(
      plano,
      async (resultado) => {
        if (resultado.linha.aba === "Áreas") throw new Error("falhou");
      },
      () => {},
    );
    expect(relatorio.map((linha) => linha.status)).toEqual(["FALHOU", "OK", "OK"]);
  });
  it("executa sequencialmente e pula dependente de falha", async () => {
    const executar = vi.fn(async (resultado: { linha: { numero: number } }) => {
      if (resultado.linha.numero === 1) throw new Error("falhou");
    });
    const plano = {
      temErros: false,
      alteracoes: 2,
      resultados: [
        { linha: { aba: "Locais", numero: 1 }, resultado: "CRIAR", detalhes: [], dependeDe: [] },
        {
          linha: { aba: "Locais", numero: 2 },
          resultado: "CRIAR",
          detalhes: [],
          dependeDe: ["Locais:1"],
        },
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
    expect(relatorio).toEqual([{ aba: "Áreas", numero: 2, status: "OK", mensagem: "Aplicada." }]);
  });

  it("na criação importa identificador manual normalizado para Componente e Sistema", async () => {
    const criarComponente = vi.fn(async (input: object) => ({ ...input, id: "componente" }));
    const criarSistema = vi.fn(async (input: object) => ({
      ...input,
      id: "sistema",
      nome: "Hidrantes",
    }));
    const resultados = [
      {
        linha: {
          aba: "Componentes",
          numero: 2,
          acao: "CRIAR",
          valores: { Nome: "Bomba", Categoria: "Hidráulica", Identificador: " cli-bom-01 " },
        },
        resultado: "CRIAR",
        detalhes: [],
        dependeDe: [],
      },
      {
        linha: {
          aba: "Sistemas",
          numero: 3,
          acao: "CRIAR",
          valores: { Nome: "Hidrantes", Categoria: "Hidráulica", Identificador: " cli-hid-01 " },
        },
        resultado: "CRIAR",
        detalhes: [],
        dependeDe: [],
      },
    ];
    const relatorio = await executarPlanoEstrutura(
      { resultados } as never,
      {
        cliente: { id: "cliente", nome: "Cliente", sigla: "CLI" },
        areas: [],
        locais: [],
        sistemas: [],
        componentes: [],
        membros: [],
        categorias: [{ id: "cat", nome: "Hidráulica" }],
        tiposLocal: [],
      } as never,
      {
        hierarquia: {} as never,
        equipamentos: { criar: criarComponente } as never,
        sistemas: { criar: criarSistema } as never,
        identificador: {} as never,
      },
      "usuario",
      vi.fn(),
    );
    expect(relatorio.map((r) => r.status)).toEqual(["OK", "OK"]);
    expect(criarComponente).toHaveBeenCalledWith(
      expect.objectContaining({ identificador: "CLI-BOM-01" }),
    );
    expect(criarSistema).toHaveBeenCalledWith(expect.objectContaining({ codigo: "CLI-HID-01" }));
  });

  it("na edição importada não solicita alterar código existente", async () => {
    const editarComponente = vi.fn(async (input: object) => ({ ...input, id: "componente" }));
    const editarSistema = vi.fn(async (input: object) => ({ ...input, id: "sistema" }));
    const resultados = [
      {
        linha: {
          aba: "Componentes",
          numero: 2,
          acao: "EDITAR",
          valores: {
            Id: "componente",
            Nome: "Bomba nova",
            Categoria: "Hidráulica",
            Identificador: "OUTRO",
          },
        },
        resultado: "EDITAR",
        detalhes: [],
        dependeDe: [],
      },
      {
        linha: {
          aba: "Sistemas",
          numero: 3,
          acao: "EDITAR",
          valores: {
            Id: "sistema",
            Nome: "Hidrantes novo",
            Categoria: "Hidráulica",
            Identificador: "OUTRO",
          },
        },
        resultado: "EDITAR",
        detalhes: [],
        dependeDe: [],
      },
    ];
    const relatorio = await executarPlanoEstrutura(
      { resultados } as never,
      {
        cliente: { id: "cliente", nome: "Cliente", sigla: "CLI" },
        areas: [],
        locais: [],
        sistemas: [],
        componentes: [],
        membros: [],
        categorias: [{ id: "cat", nome: "Hidráulica" }],
        tiposLocal: [],
      } as never,
      {
        hierarquia: {} as never,
        equipamentos: { editar: editarComponente } as never,
        sistemas: { editar: editarSistema } as never,
        identificador: {} as never,
      },
      "usuario",
      vi.fn(),
    );
    expect(relatorio.map((r) => r.status)).toEqual(["OK", "OK"]);
    expect(editarComponente.mock.calls[0]?.[0]).not.toHaveProperty("alterarIdentificador", true);
    expect(editarSistema.mock.calls[0]?.[0]).not.toHaveProperty("alterarIdentificador", true);
  });
});
