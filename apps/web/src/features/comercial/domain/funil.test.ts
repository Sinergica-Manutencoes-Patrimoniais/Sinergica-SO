import { describe, expect, it } from "vitest";
import {
  type Etapa,
  type Oportunidade,
  agruparOportunidadesPorEtapa,
  aplicarTransicao,
  etapaPadrao,
  etapasVisiveis,
  exigeMotivo,
  moverEtapa,
  podeDesativarEtapa,
  podeReceberCard,
  resumirColuna,
  transicaoInvalida,
  validarTituloOportunidade,
  validarValorEstimado,
} from "./funil";

function etapa(over: Partial<Etapa> = {}): Etapa {
  return {
    id: "e1",
    nome: "Lead",
    ordem: 1,
    cor: "#2563EB",
    tipo: "aberta",
    ativo: true,
    ...over,
  };
}

const LEAD = etapa();
const NEGOCIACAO = etapa({ id: "e2", nome: "Negociação", ordem: 4 });
const GANHO = etapa({ id: "e3", nome: "Ganho", ordem: 5, tipo: "ganha" });
const PERDIDO = etapa({ id: "e4", nome: "Perdido", ordem: 6, tipo: "perdida" });

describe("etapasVisiveis", () => {
  it("ordena por ordem e esconde as inativas", () => {
    const inativa = etapa({ id: "x", nome: "Antiga", ordem: 2, ativo: false });
    const visiveis = etapasVisiveis([GANHO, inativa, LEAD, NEGOCIACAO]);
    expect(visiveis.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });
});

describe("etapaPadrao", () => {
  it("devolve a primeira etapa aberta na ordem", () => {
    expect(etapaPadrao([GANHO, NEGOCIACAO, LEAD]).id).toBe("e1");
  });

  it("ignora etapa aberta inativa", () => {
    const inativa = etapa({ id: "x", ordem: 0, ativo: false });
    expect(etapaPadrao([inativa, LEAD]).id).toBe("e1");
  });

  // Funil sem etapa aberta é configuração inválida — falhar aqui evita criar oportunidade
  // já fechada, que sujaria conversão e ciclo de venda.
  it("lança quando não há nenhuma etapa aberta ativa", () => {
    expect(() => etapaPadrao([GANHO, PERDIDO])).toThrow(/Nenhuma etapa aberta/);
  });

  it("lança com lista vazia", () => {
    expect(() => etapaPadrao([])).toThrow(/Nenhuma etapa aberta/);
  });
});

describe("exigeMotivo / podeReceberCard", () => {
  it("só etapa perdida exige motivo", () => {
    expect(exigeMotivo(PERDIDO)).toBe(true);
    expect(exigeMotivo(GANHO)).toBe(false);
    expect(exigeMotivo(LEAD)).toBe(false);
  });

  it("etapa inativa não recebe card", () => {
    expect(podeReceberCard(etapa({ ativo: false }))).toBe(false);
    expect(podeReceberCard(LEAD)).toBe(true);
  });
});

describe("transicaoInvalida", () => {
  it("aceita movimento para etapa aberta", () => {
    expect(transicaoInvalida({ destino: NEGOCIACAO })).toBeNull();
  });

  it("aceita ganho sem motivo", () => {
    expect(transicaoInvalida({ destino: GANHO })).toBeNull();
  });

  it("recusa perda sem motivo", () => {
    expect(transicaoInvalida({ destino: PERDIDO })).toMatch(/motivo da perda/i);
  });

  it("aceita perda com motivo", () => {
    expect(transicaoInvalida({ destino: PERDIDO, motivoPerdaId: "m1" })).toBeNull();
  });

  it("recusa etapa desativada", () => {
    const inativa = etapa({ nome: "Antiga", ativo: false });
    expect(transicaoInvalida({ destino: inativa })).toMatch(/desativada/i);
  });

  it("motivo vazio conta como ausente", () => {
    expect(transicaoInvalida({ destino: PERDIDO, motivoPerdaId: "" })).toMatch(/motivo/i);
  });
});

describe("aplicarTransicao", () => {
  const agora = new Date("2026-08-10T12:00:00.000Z");

  it("fecha ao entrar em etapa ganha e não guarda motivo", () => {
    const r = aplicarTransicao(GANHO, null, agora);
    expect(r).toEqual({
      etapaId: "e3",
      motivoPerdaId: null,
      fechadaEm: "2026-08-10T12:00:00.000Z",
    });
  });

  it("fecha ao entrar em etapa perdida guardando o motivo", () => {
    const r = aplicarTransicao(PERDIDO, "m1", agora);
    expect(r.fechadaEm).toBe("2026-08-10T12:00:00.000Z");
    expect(r.motivoPerdaId).toBe("m1");
  });

  // Reabrir precisa limpar as duas coisas: senão sobra motivo de perda numa oportunidade
  // que voltou para negociação, e o dashboard conta como perdida.
  it("reabrir limpa fechamento e motivo", () => {
    const r = aplicarTransicao(NEGOCIACAO, "m1", agora);
    expect(r).toEqual({ etapaId: "e2", motivoPerdaId: null, fechadaEm: null });
  });

  it("ganho descarta motivo passado por engano", () => {
    expect(aplicarTransicao(GANHO, "m1", agora).motivoPerdaId).toBeNull();
  });
});

describe("podeDesativarEtapa", () => {
  it("permite desativar etapa terminal", () => {
    expect(podeDesativarEtapa(GANHO, [LEAD, GANHO])).toBeNull();
  });

  it("permite desativar aberta quando há outra aberta", () => {
    expect(podeDesativarEtapa(LEAD, [LEAD, NEGOCIACAO, GANHO])).toBeNull();
  });

  it("recusa desativar a última etapa aberta", () => {
    expect(podeDesativarEtapa(LEAD, [LEAD, GANHO, PERDIDO])).toMatch(/última etapa aberta/i);
  });

  it("não conta etapa aberta já inativa como alternativa", () => {
    const inativa = etapa({ id: "x", ativo: false });
    expect(podeDesativarEtapa(LEAD, [LEAD, inativa, GANHO])).toMatch(/última etapa aberta/i);
  });
});

describe("validarTituloOportunidade", () => {
  it("apara espaços", () => {
    expect(validarTituloOportunidade("  Reforma fachada  ")).toBe("Reforma fachada");
  });

  it("recusa título vazio ou só espaços", () => {
    expect(() => validarTituloOportunidade("   ")).toThrow(/obrigatório/i);
  });
});

describe("validarValorEstimado", () => {
  it("aceita centavos inteiros e zero", () => {
    expect(validarValorEstimado(150000)).toBe(150000);
    expect(validarValorEstimado(0)).toBe(0);
  });

  // null (desconhecido) e 0 (negócio sem valor) são coisas diferentes — não colapsar.
  it("mantém null como null", () => {
    expect(validarValorEstimado(null)).toBeNull();
    expect(validarValorEstimado(undefined)).toBeNull();
  });

  it("recusa fração e negativo", () => {
    expect(() => validarValorEstimado(10.5)).toThrow(/centavos inteiros/i);
    expect(() => validarValorEstimado(-1)).toThrow(/negativo/i);
  });
});

function oportunidade(over: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "op1",
    clienteId: "c1",
    etapaId: "e1",
    titulo: "Negócio",
    descricao: null,
    valorEstimadoCentavos: null,
    score: null,
    resumo: null,
    origem: null,
    leadTier: null,
    clusterNome: null,
    conversaId: null,
    responsavelId: null,
    motivoPerdaId: null,
    fechadaEm: null,
    criadaEm: "2026-08-11T00:00:00.000Z",
    ...over,
  };
}

describe("agruparOportunidadesPorEtapa / resumirColuna", () => {
  it("agrupa por etapa preservando a ordem de chegada", () => {
    const ops = [
      oportunidade({ id: "1", etapaId: "e1" }),
      oportunidade({ id: "2", etapaId: "e2" }),
      oportunidade({ id: "3", etapaId: "e1" }),
    ];
    const grupos = agruparOportunidadesPorEtapa(ops);
    expect(grupos.get("e1")?.map((o) => o.id)).toEqual(["1", "3"]);
    expect(grupos.get("e2")?.map((o) => o.id)).toEqual(["2"]);
  });

  it("etapa sem oportunidade não aparece no mapa (coluna trata como vazio)", () => {
    const grupos = agruparOportunidadesPorEtapa([oportunidade({ etapaId: "e1" })]);
    expect(grupos.has("e9")).toBe(false);
  });

  it("soma valores, ignorando null (valor desconhecido não é zero, mas também não soma)", () => {
    const resumo = resumirColuna("e1", [
      oportunidade({ valorEstimadoCentavos: 10_000 }),
      oportunidade({ valorEstimadoCentavos: null }),
      oportunidade({ valorEstimadoCentavos: 5_000 }),
    ]);
    expect(resumo).toEqual({ etapaId: "e1", quantidade: 3, somaValorCentavos: 15_000 });
  });

  it("coluna vazia soma zero sem lançar", () => {
    expect(resumirColuna("e1", [])).toEqual({ etapaId: "e1", quantidade: 0, somaValorCentavos: 0 });
  });
});

describe("moverEtapa", () => {
  it("subir troca a ordem com a vizinha anterior", () => {
    const resultado = moverEtapa([LEAD, NEGOCIACAO], "e2", "cima");
    expect(resultado.find((e) => e.id === "e1")?.ordem).toBe(4);
    expect(resultado.find((e) => e.id === "e2")?.ordem).toBe(1);
  });

  it("descer troca a ordem com a vizinha seguinte", () => {
    const resultado = moverEtapa([LEAD, NEGOCIACAO], "e1", "baixo");
    expect(resultado.find((e) => e.id === "e1")?.ordem).toBe(4);
    expect(resultado.find((e) => e.id === "e2")?.ordem).toBe(1);
  });

  it("primeira etapa não sobe (não há vizinha acima)", () => {
    const resultado = moverEtapa([LEAD, NEGOCIACAO], "e1", "cima");
    expect(resultado.find((e) => e.id === "e1")?.ordem).toBe(1);
    expect(resultado.find((e) => e.id === "e2")?.ordem).toBe(4);
  });

  it("última etapa não desce (não há vizinha abaixo)", () => {
    const resultado = moverEtapa([LEAD, NEGOCIACAO], "e2", "baixo");
    expect(resultado.find((e) => e.id === "e2")?.ordem).toBe(4);
  });

  it("etapa inativa não entra no reordenamento visível", () => {
    const inativa = etapa({ id: "x", ordem: 2, ativo: false });
    const resultado = moverEtapa([LEAD, inativa, NEGOCIACAO], "e2", "cima");
    // e2 (ordem 4) sobe para trocar com LEAD (ordem 1) — a inativa (ordem 2) é ignorada.
    expect(resultado.find((e) => e.id === "e2")?.ordem).toBe(1);
    expect(resultado.find((e) => e.id === "e1")?.ordem).toBe(4);
    expect(resultado.find((e) => e.id === "x")?.ordem).toBe(2);
  });

  it("id inexistente não altera nada", () => {
    const resultado = moverEtapa([LEAD, NEGOCIACAO], "inexistente", "cima");
    expect(resultado).toEqual([LEAD, NEGOCIACAO]);
  });
});
