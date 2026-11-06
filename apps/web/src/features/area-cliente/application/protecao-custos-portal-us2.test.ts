import { formatarPropostaPublica } from "@sinergica/shared";
import { describe, expect, it } from "vitest";

describe("E01-S184: documento público", () => {
  it("não usa custos nem totais internos como preço de venda", () => {
    const texto = formatarPropostaPublica(
      {
        proposta: {
          tipo: "simples",
          escopo: "Manutenção",
          preco_centavos: 150000,
          versao_atual: 2,
        },
        itens: [
          {
            descricao: "Material",
            quantidade: 3,
            custo_unitario_centavos: 999999,
            total_centavos: 2999997,
          },
        ],
      },
      "Conta A",
    );
    expect(texto).toContain("Material");
    expect(texto).toMatch(/1\.500,00/);
    expect(texto).not.toMatch(/9\.999,99|29\.999,97/);
  });

  it("apresenta preço de venda explícito sem completar valores ausentes", () => {
    const texto = formatarPropostaPublica(
      { proposta: {}, itens: [{ descricao: "Peça", quantidade: 2, preco_venda_centavos: 1200 }] },
      "Conta A",
    );
    expect(texto).toMatch(/12,00/);
    expect(texto).not.toMatch(/24,00/);
  });

  it("não expõe conteúdo aninhado em campos públicos com tipos inválidos", () => {
    const texto = formatarPropostaPublica(
      {
        proposta: {
          tipo: ["CUSTO-SENTINELA"],
          escopo: { custo: "CUSTO-SENTINELA" },
          versao_atual: ["CUSTO-SENTINELA"],
          preco_centavos: 150000,
        },
        itens: [{ descricao: { custo: "CUSTO-SENTINELA" }, quantidade: 2 }],
      },
      "Conta A",
    );
    expect(texto).not.toContain("CUSTO-SENTINELA");
    expect(texto).toContain("1.500,00");
  });
});
