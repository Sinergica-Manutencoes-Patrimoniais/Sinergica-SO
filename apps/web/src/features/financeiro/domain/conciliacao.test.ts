import { describe, expect, it } from "vitest";
import { aplicarRegraClassificacao, candidatosConciliacao } from "./conciliacao";
import type { LancamentoPrevistoCandidato, RegraClassificacao } from "./conciliacao";

describe("aplicarRegraClassificacao", () => {
  const regras: RegraClassificacao[] = [
    {
      id: "r1",
      padrao: "posto shell",
      categoriaId: "cat-combustivel",
      clienteId: null,
      fornecedorId: null,
      ativo: true,
    },
    {
      id: "r2",
      padrao: "condominio araguaia",
      categoriaId: "cat-receita",
      clienteId: "cli-araguaia",
      fornecedorId: null,
      ativo: true,
    },
    {
      id: "r3",
      padrao: "inativa",
      categoriaId: "cat-x",
      clienteId: null,
      fornecedorId: null,
      ativo: false,
    },
  ];

  it("casa por substring case-insensitive", () => {
    const sugestao = aplicarRegraClassificacao("COMBUSTIVEL POSTO SHELL", regras);
    expect(sugestao?.categoriaId).toBe("cat-combustivel");
  });

  it("ignora acento na comparação", () => {
    const sugestao = aplicarRegraClassificacao("RECEBIMENTO CONDOMÍNIO ARAGUAIA", regras);
    expect(sugestao?.clienteId).toBe("cli-araguaia");
  });

  it("nao casa regra inativa", () => {
    expect(aplicarRegraClassificacao("TEXTO INATIVA AQUI", regras)).toBeNull();
  });

  it("memo nulo nao casa nada", () => {
    expect(aplicarRegraClassificacao(null, regras)).toBeNull();
  });

  it("sem match retorna null", () => {
    expect(aplicarRegraClassificacao("ALGO SEM REGRA", regras)).toBeNull();
  });
});

describe("candidatosConciliacao", () => {
  const previstos: LancamentoPrevistoCandidato[] = [
    {
      id: "l1",
      contaId: "conta-1",
      tipo: "saida",
      valorCentavos: 15000,
      dataVencimento: "2026-07-05",
    },
    {
      id: "l2",
      contaId: "conta-1",
      tipo: "entrada",
      valorCentavos: 15000,
      dataVencimento: "2026-07-05",
    },
    {
      id: "l3",
      contaId: "conta-2",
      tipo: "saida",
      valorCentavos: 15000,
      dataVencimento: "2026-07-05",
    },
    {
      id: "l4",
      contaId: "conta-1",
      tipo: "saida",
      valorCentavos: 15000,
      dataVencimento: "2026-08-01",
    },
  ];

  it("debito (valor negativo) so casa com previsto de saida, mesmo valor em modulo", () => {
    const candidatos = candidatosConciliacao(
      { contaId: "conta-1", valorCentavos: -15000, data: "2026-07-03" },
      previstos,
    );
    expect(candidatos.map((c) => c.id)).toEqual(["l1"]);
  });

  it("credito (valor positivo) so casa com previsto de entrada", () => {
    const candidatos = candidatosConciliacao(
      { contaId: "conta-1", valorCentavos: 15000, data: "2026-07-03" },
      previstos,
    );
    expect(candidatos.map((c) => c.id)).toEqual(["l2"]);
  });

  it("ignora conta diferente", () => {
    const candidatos = candidatosConciliacao(
      { contaId: "conta-1", valorCentavos: -15000, data: "2026-07-05" },
      previstos,
    );
    expect(candidatos.map((c) => c.id)).not.toContain("l3");
  });

  it("fora da janela de +-5 dias nao entra", () => {
    const candidatos = candidatosConciliacao(
      { contaId: "conta-1", valorCentavos: -15000, data: "2026-07-03" },
      previstos,
    );
    expect(candidatos.map((c) => c.id)).not.toContain("l4");
  });

  it("dentro da janela de 5 dias entra (borda)", () => {
    const candidatos = candidatosConciliacao(
      { contaId: "conta-1", valorCentavos: -15000, data: "2026-06-30" },
      previstos,
    );
    expect(candidatos.map((c) => c.id)).toContain("l1");
  });
});
