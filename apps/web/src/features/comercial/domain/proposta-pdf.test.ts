import { describe, expect, it } from "vitest";
import { formatarTextoProposta } from "./proposta-pdf";

// `toLocaleString("pt-BR", { style: "currency" })` usa espaço NÃO-QUEBRÁVEL (U+00A0) entre "R$" e
// o valor — normaliza pra espaço comum antes de comparar, senão a assertion falha por um caractere
// invisível que não é bug nenhum.
const NBSP = String.fromCharCode(160);
function semNbsp(texto: string): string {
  return texto.split(NBSP).join(" ");
}

describe("formatarTextoProposta", () => {
  it("monta Conta, tipo, versão, validade, escopo, composição e valor", () => {
    const texto = semNbsp(
      formatarTextoProposta(
        {
          proposta: {
            tipo: "simples",
            escopo: "Manutenção preventiva mensal",
            preco_centavos: 150_000,
            valido_ate: "2026-09-15",
            versao_atual: 2,
          },
          itens: [
            {
              descricao: "8h técnico",
              quantidade: 8,
              custo_unitario_centavos: 2_000,
              total_centavos: 16_000,
            },
          ],
        },
        "Condomínio Teste",
      ),
    );
    expect(texto).toContain("Conta: Condomínio Teste");
    expect(texto).toContain("Tipo: Simples");
    expect(texto).toContain("Versão: 2");
    expect(texto).toContain("Validade: 15/09/2026");
    expect(texto).toContain("Manutenção preventiva mensal");
    expect(texto).toContain("8h técnico · 8 × R$ 20,00 = R$ 160,00");
    expect(texto).toContain("Valor total: R$ 1.500,00");
  });

  it("payload sem itens: composição avisa sem quebrar", () => {
    const texto = formatarTextoProposta({ proposta: { tipo: "simples" }, itens: [] }, "Conta X");
    expect(texto).toContain("Composição: nenhum item.");
  });

  it("sem validade: mensagem explícita, não data inválida", () => {
    const texto = formatarTextoProposta({ proposta: {}, itens: [] }, "Conta X");
    expect(texto).toContain("Validade: sem validade definida");
  });

  it("sem escopo: 'Não informado', não string vazia", () => {
    const texto = formatarTextoProposta({ proposta: { escopo: "  " }, itens: [] }, "Conta X");
    expect(texto).toContain("Não informado.");
  });

  it("payload sem 'proposta' nem 'itens' (v1 bruta de fn_criar_proposta): não lança", () => {
    expect(() => formatarTextoProposta({}, "Conta X")).not.toThrow();
  });

  it("observações só aparecem quando preenchidas", () => {
    const semObs = formatarTextoProposta({ proposta: {}, itens: [] }, "Conta X");
    expect(semObs).not.toContain("Observações:");
    const comObs = formatarTextoProposta(
      { proposta: { observacoes: "Cliente pediu revisão trimestral" }, itens: [] },
      "Conta X",
    );
    expect(comObs).toContain("Observações:");
    expect(comObs).toContain("Cliente pediu revisão trimestral");
  });

  it("total do item cai pro cálculo quantidade×custo quando total_centavos ausente", () => {
    const texto = semNbsp(
      formatarTextoProposta(
        {
          proposta: {},
          itens: [{ descricao: "Material", quantidade: 3, custo_unitario_centavos: 1_000 }],
        },
        "Conta X",
      ),
    );
    expect(texto).toContain("Material · 3 × R$ 10,00 = R$ 30,00");
  });
});
