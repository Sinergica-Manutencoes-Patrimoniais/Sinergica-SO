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
});
