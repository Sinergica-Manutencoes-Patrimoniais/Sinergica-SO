import { describe, expect, it } from "vitest";
import {
  type CoberturaPlanoPmoc,
  FRASE_CLIENTE_SEM_PMOC,
  FRASE_NENHUM_CONTRATO_PENDENTE,
  FRASE_PMOC_INDISPONIVEL,
  mensagemDeErroDeCriacao,
  motivoDoErroPmoc,
  nomeSugeridoDoPlano,
  percentualConvertido,
} from "./plano-pmoc-manual";

const cobertura = (p: Partial<CoberturaPlanoPmoc> = {}): CoberturaPlanoPmoc => ({
  clienteId: "11111111-1111-4111-8111-111111111111",
  contratosTotal: 4,
  contratosComPlano: 1,
  contratosSemPlano: 3,
  planosModalidadePmoc: 1,
  contratosSemCliente: 0,
  ...p,
});

describe("progresso da conversão manual", () => {
  it("mostra o percentual convertido", () => {
    expect(percentualConvertido(cobertura())).toBe(25);
    expect(percentualConvertido(cobertura({ contratosComPlano: 4, contratosSemPlano: 0 }))).toBe(
      100,
    );
  });

  it("Cliente sem Contrato PMOC não vira divisão por zero nem 0% eterno", () => {
    expect(
      percentualConvertido(
        cobertura({ contratosTotal: 0, contratosComPlano: 0, contratosSemPlano: 0 }),
      ),
    ).toBe(100);
  });
});

describe("herança do que é derivável", () => {
  it("o nome sugerido é o mesmo que a RPC deriva, para tela e banco não divergirem", () => {
    expect(nomeSugeridoDoPlano({ imovelNome: "Edifício Guainumbi" })).toBe(
      "PMOC — Edifício Guainumbi",
    );
  });

  it("respeita o limite de 200 caracteres de planos_manutencao.nome", () => {
    expect(nomeSugeridoDoPlano({ imovelNome: "x".repeat(400) })).toHaveLength(200);
  });
});

describe("cada recusa tem a sua própria frase — nenhum return null silencioso", () => {
  it("separa gate fechado, sem permissão, autorização em alteração e erro", () => {
    expect(motivoDoErroPmoc({ message: "operacao_desabilitada" })).toBe("gate-fechado");
    expect(motivoDoErroPmoc({ message: "fonte_desabilitada" })).toBe("gate-fechado");
    expect(motivoDoErroPmoc({ message: "sem_acesso", code: "42501" })).toBe("sem-capacidade");
    expect(motivoDoErroPmoc({ message: "autorizacao_em_alteracao" })).toBe(
      "autorizacao-em-alteracao",
    );
    expect(motivoDoErroPmoc(new Error("timeout"))).toBe("erro");
  });

  it("as frases dos cinco motivos e dos dois vazios legítimos são todas diferentes", () => {
    const frases = [
      ...Object.values(FRASE_PMOC_INDISPONIVEL),
      FRASE_NENHUM_CONTRATO_PENDENTE,
      FRASE_CLIENTE_SEM_PMOC,
    ];
    expect(new Set(frases).size).toBe(frases.length);
  });
});

describe("recusas nomeadas da criação viram português", () => {
  it("dois Planos para o mesmo Contrato é recusa explicada, não erro cru", () => {
    expect(mensagemDeErroDeCriacao({ message: "contrato_pmoc_ja_tem_plano" })).toContain(
      "já tem um Plano de Manutenção",
    );
  });

  it("imóvel sem Cliente manda corrigir o cadastro PMOC, não parece falta de permissão", () => {
    const frase = mensagemDeErroDeCriacao({ message: "contrato_pmoc_sem_cliente" });
    expect(frase).toContain("módulo PMOC");
    expect(frase).not.toBe(mensagemDeErroDeCriacao({ message: "sem_acesso" }));
  });

  it("falta de confirmação humana é dita como tal — é a trava da decisão (b)", () => {
    expect(mensagemDeErroDeCriacao({ message: "criacao_nao_confirmada" })).toContain(
      "criado à mão pelo PCM",
    );
  });

  it("erro desconhecido ainda diz o que fazer, com o mesmo pedido", () => {
    expect(mensagemDeErroDeCriacao(new Error("boom"))).toContain("mesmos dados");
  });
});
