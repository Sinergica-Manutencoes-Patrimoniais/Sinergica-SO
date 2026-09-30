import { describe, expect, it } from "vitest";
import {
  CABECALHOS,
  montarPlanilhaEstrutura,
  parsearPlanilhaEstrutura,
  planejarImportacao,
} from "./importacao-estrutura";

const estado = {
  cliente: { id: "c", nome: "Cliente" },
  areas: [
    { id: "a", nome: "Área", clienteId: "c", sigla: "ARE", descricao: null, ordem: 0, ativo: true },
  ],
  locais: [],
  sistemas: [],
  componentes: [],
  membros: [],
  categorias: [{ id: "cat", nome: "PCI", sigla: "PCI" }],
  tiposLocal: [],
};

describe("importação de estrutura", () => {
  it("exporta cabeçalhos e aceita variação de cabeçalho", () => {
    const abas = montarPlanilhaEstrutura(estado);
    expect(abas.Áreas?.[0]).toEqual(CABECALHOS.Áreas);
    const entrada = {
      ...abas,
      Áreas: [
        ["acao", "id", "nome", "sigla", "ordem"],
        ["CRIAR", "", "Nova", "NOV", 1],
      ],
    };
    expect(parsearPlanilhaEstrutura(entrada).linhas).toHaveLength(1);
  });

  it("bloqueia aba auxiliar obrigatória ausente", () => {
    const { Listas: _listas, ...semListas } = montarPlanilhaEstrutura(estado);
    expect(parsearPlanilhaEstrutura(semListas).errosGerais).toContain(
      "Aba «Listas» ausente ou com colunas diferentes do modelo.",
    );
  });

  it("bloqueia criar com Id e categoria ausente", () => {
    const plano = planejarImportacao(
      [
        {
          aba: "Sistemas",
          numero: 2,
          acao: "CRIAR",
          valores: { Id: "x", Nome: "Sistema", Categoria: "" },
        },
      ],
      estado,
    );
    expect(plano.temErros).toBe(true);
    expect(plano.resultados[0]?.detalhes).toContain("Linha de CRIAR não pode ter Id.");
  });

  it("reimporta exportação intacta sem alterações", () => {
    const abas = montarPlanilhaEstrutura(estado);
    const lida = parsearPlanilhaEstrutura(abas);
    const plano = planejarImportacao(lida.linhas, estado);
    expect(plano.alteracoes).toBe(0);
    expect(plano.temErros).toBe(false);
  });

  it("ordena Área e Local filho criados na mesma planilha e registra dependência", () => {
    const plano = planejarImportacao(
      [
        {
          aba: "Locais",
          numero: 4,
          acao: "CRIAR",
          valores: {
            Área: "Nova",
            "Local pai": "Raiz",
            Nome: "Filho",
            Sigla: "FIL",
            "Tipo de Local": "",
            Ordem: "0",
          },
        },
        {
          aba: "Áreas",
          numero: 2,
          acao: "CRIAR",
          valores: { Nome: "Nova", Sigla: "NOV", Ordem: "0" },
        },
        {
          aba: "Locais",
          numero: 3,
          acao: "CRIAR",
          valores: {
            Área: "Nova",
            "Local pai": "",
            Nome: "Raiz",
            Sigla: "RAI",
            "Tipo de Local": "",
            Ordem: "0",
          },
        },
      ],
      estado,
    );
    expect(plano.temErros).toBe(false);
    expect(plano.resultados.map((resultado) => resultado.linha.numero)).toEqual([2, 3, 4]);
    expect(plano.resultados[2]?.dependeDe).toContain(3);
  });

  it("mostra diffs e bloqueia referências inválidas", () => {
    const plano = planejarImportacao(
      [
        {
          aba: "Áreas",
          numero: 2,
          acao: "EDITAR",
          valores: { Id: "a", Nome: "Área nova", Sigla: "ARE", Ordem: "0" },
        },
        {
          aba: "Locais",
          numero: 3,
          acao: "CRIAR",
          valores: {
            Área: "Inexistente",
            "Local pai": "",
            Nome: "Sala",
            Sigla: "SAL",
            "Tipo de Local": "",
            Ordem: "0",
          },
        },
      ],
      estado,
    );
    expect(plano.resultados[0]?.detalhes).toContain("Nome: Área → Área nova");
    expect(plano.resultados[1]?.detalhes).toContain("Área «Inexistente» não existe.");
  });

  it("bloqueia Id repetido, sigla inválida e categoria fora do catálogo", () => {
    const plano = planejarImportacao(
      [
        {
          aba: "Áreas",
          numero: 2,
          acao: "EDITAR",
          valores: { Id: "a", Nome: "Área", Sigla: "AB", Ordem: "0" },
        },
        { aba: "Áreas", numero: 3, acao: "EXCLUIR", valores: { Id: "a" } },
        {
          aba: "Componentes",
          numero: 2,
          acao: "CRIAR",
          valores: { Nome: "Bomba", Categoria: "Fora" },
        },
      ],
      estado,
    );
    expect(plano.resultados.flatMap((resultado) => resultado.detalhes)).toEqual(
      expect.arrayContaining([
        "Id repetido na planilha (linhas 2 e 3).",
        "Sigla deve ter exatamente 3 letras ou números.",
        "Categoria «Fora» não existe. Cadastre em Categorias de Ativo.",
      ]),
    );
  });
});
