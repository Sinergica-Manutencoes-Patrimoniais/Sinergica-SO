import { describe, expect, it } from "vitest";
import {
  aplicarTransicao,
  type Etapa,
  etapaPadrao,
  etapasVisiveis,
  exigeMotivo,
  podeDesativarEtapa,
  podeReceberCard,
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
