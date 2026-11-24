// E01-S201 — regras puras do monitor de exceções do Auvo (T−24).
//
// O que estes testes protegem (AC-10): "nenhuma exceção", "recurso desligado", "sem capacidade" e
// "sem Cliente" têm de produzir frases DIFERENTES. Num monitor de exceções, confundir silêncio
// com saúde é o pior defeito possível — e é exatamente o que um `return null` silencioso faria.
import { describe, expect, it } from "vitest";
import {
  type ExcecaoAuvo,
  avisoMonitorExcecoes,
  contarPorTipo,
  rotuloErroExcecao,
  rotuloTipoExcecao,
} from "./excecoes-auvo";

const base = {
  flagLigada: true,
  clienteSelecionado: true,
  carregando: false,
  erro: null as unknown,
  total: 1,
};

function excecao(parcial: Partial<ExcecaoAuvo> & Pick<ExcecaoAuvo, "tipo">): ExcecaoAuvo {
  return {
    clienteId: "11111111-1111-4111-8111-111111111111",
    clienteNome: "Cliente",
    visitaId: null,
    visitaInicioEm: null,
    osId: "22222222-2222-4222-8222-222222222222",
    osNumero: "OS-1",
    taskId: null,
    tentativas: 0,
    ultimoErro: "sem_motivo_registrado",
    ocorridoEm: "2026-11-24T10:00:00Z",
    ...parcial,
  };
}

describe("avisoMonitorExcecoes — AC-10", () => {
  it("flag desligada se anuncia, em vez de sumir da tela", () => {
    expect(avisoMonitorExcecoes({ ...base, flagLigada: false })).toContain("ainda não ativado");
  });

  it("sem Cliente selecionado pede o Cliente, não finge lista vazia", () => {
    expect(avisoMonitorExcecoes({ ...base, clienteSelecionado: false })).toContain(
      "Selecione um Cliente",
    );
  });

  it("gate fechado no banco tem frase própria, diferente da flag desligada", () => {
    const gate = avisoMonitorExcecoes({ ...base, erro: { message: "consulta_desabilitada" } });
    const flag = avisoMonitorExcecoes({ ...base, flagLigada: false });
    expect(gate).toContain("para este Cliente");
    expect(gate).not.toEqual(flag);
  });

  it("falta de capacidade não vira 'nada a ver aqui'", () => {
    expect(avisoMonitorExcecoes({ ...base, erro: { message: "sem_acesso" } })).toContain(
      "capacidade de validação",
    );
  });

  it("autorização em alteração convida a tentar de novo", () => {
    expect(
      avisoMonitorExcecoes({ ...base, erro: { message: "autorizacao_em_alteracao" } }),
    ).toContain("Tente de novo");
  });

  it("erro desconhecido ainda fala, com frase genérica", () => {
    expect(avisoMonitorExcecoes({ ...base, erro: { message: "boom" } })).toContain(
      "Não foi possível",
    );
  });

  it("zero exceções é afirmação explícita de saúde, nunca ausência de texto", () => {
    const aviso = avisoMonitorExcecoes({ ...base, total: 0 });
    expect(aviso).toContain("Nenhuma exceção");
    expect(aviso).not.toBeNull();
  });

  it("as sete frases são todas distintas entre si", () => {
    const frases = [
      avisoMonitorExcecoes({ ...base, flagLigada: false }),
      avisoMonitorExcecoes({ ...base, clienteSelecionado: false }),
      avisoMonitorExcecoes({ ...base, erro: { message: "consulta_desabilitada" } }),
      avisoMonitorExcecoes({ ...base, erro: { message: "sem_acesso" } }),
      avisoMonitorExcecoes({ ...base, erro: { message: "autorizacao_em_alteracao" } }),
      avisoMonitorExcecoes({ ...base, erro: { message: "boom" } }),
      avisoMonitorExcecoes({ ...base, total: 0 }),
    ];
    expect(new Set(frases).size).toBe(frases.length);
  });

  it("com exceções na lista, quem fala é a tabela", () => {
    expect(avisoMonitorExcecoes(base)).toBeNull();
  });

  it("carregando não anuncia 'nenhuma exceção' por engano", () => {
    expect(avisoMonitorExcecoes({ ...base, carregando: true, total: 0 })).toBeNull();
  });
});

describe("contarPorTipo — AC-1", () => {
  it("sempre devolve as três famílias, mesmo zeradas", () => {
    expect(contarPorTipo([])).toEqual({
      falha_envio: 0,
      visita_nao_confirmada: 0,
      tarefa_orfa: 0,
    });
  });

  it("conta cada família separadamente", () => {
    const contagem = contarPorTipo([
      excecao({ tipo: "falha_envio", osId: "a" }),
      excecao({ tipo: "falha_envio", osId: "b" }),
      excecao({ tipo: "tarefa_orfa", osId: "c" }),
    ]);
    expect(contagem).toEqual({ falha_envio: 2, visita_nao_confirmada: 0, tarefa_orfa: 1 });
  });
});

describe("rótulos", () => {
  it("traduz as três famílias", () => {
    expect(rotuloTipoExcecao("falha_envio")).toBe("Falha de envio");
    expect(rotuloTipoExcecao("visita_nao_confirmada")).toBe("Visita não confirmada");
    expect(rotuloTipoExcecao("tarefa_orfa")).toBe("Tarefa órfã");
  });

  it("traduz motivos conhecidos das três origens (livro T−24, Visita, origem de campo)", () => {
    expect(rotuloErroExcecao("timeout_auvo")).toBe("Sem resposta do Auvo no prazo");
    expect(rotuloErroExcecao("visita_planejada")).toBe("Visita planejada, sem confirmação");
    expect(rotuloErroExcecao("referencia_ausente")).toBe("Sem referência de Chamado");
  });

  it("código desconhecido nunca some da tela — cai nele mesmo", () => {
    expect(rotuloErroExcecao("motivo_que_ainda_nao_existe")).toBe("motivo_que_ainda_nao_existe");
  });
});
