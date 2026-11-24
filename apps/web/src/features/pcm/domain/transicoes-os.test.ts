import { describe, expect, it } from "vitest";
import {
  destinosPermitidos,
  ehStatusDoFluxoAprovado,
  ehStatusLegado,
  transicaoPermitida,
} from "./transicoes-os";

describe("transicoes-os — matriz do fluxo aprovado (BL 007 AC-7)", () => {
  it("o caminho feliz inteiro é permitido, etapa a etapa", () => {
    expect(transicaoPermitida("solicitacao", "planejamento").permitida).toBe(true);
    expect(transicaoPermitida("planejamento", "em_execucao").permitida).toBe(true);
    expect(transicaoPermitida("em_execucao", "validacao_pcm").permitida).toBe(true);
    expect(transicaoPermitida("validacao_pcm", "finalizado").permitida).toBe(true);
  });

  it("não se pula a Validação PCM para finalizar", () => {
    const r = transicaoPermitida("em_execucao", "finalizado");
    expect(r.permitida).toBe(false);
    expect(r.motivo).toContain("validação do PCM");
  });

  it("não se salta de Solicitação direto para execução", () => {
    expect(transicaoPermitida("solicitacao", "em_execucao").permitida).toBe(false);
  });

  it("o PCM pode devolver para execução quando reprova o retorno", () => {
    expect(transicaoPermitida("validacao_pcm", "em_execucao").permitida).toBe(true);
  });

  it("replanejar é permitido: execução volta para Planejamento", () => {
    expect(transicaoPermitida("em_execucao", "planejamento").permitida).toBe(true);
  });

  it("cancelar é permitido de qualquer etapa viva", () => {
    for (const de of ["solicitacao", "planejamento", "em_execucao", "validacao_pcm"] as const)
      expect(transicaoPermitida(de, "cancelado").permitida).toBe(true);
  });

  it("OS finalizada não volta pelo quadro — reabertura é fluxo próprio", () => {
    const r = transicaoPermitida("finalizado", "em_execucao");
    expect(r.permitida).toBe(false);
    expect(r.motivo).toContain("reabertura");
  });

  it("OS cancelada não volta pelo quadro — reativação é fluxo próprio", () => {
    const r = transicaoPermitida("cancelado", "planejamento");
    expect(r.permitida).toBe(false);
    expect(r.motivo).toContain("reativação");
  });

  it("mover para o mesmo status é no-op permitido (soltar o cartão onde já estava)", () => {
    expect(transicaoPermitida("planejamento", "planejamento").permitida).toBe(true);
  });

  it("toda recusa traz motivo em texto — nunca recusa muda", () => {
    const recusas = [
      transicaoPermitida("em_execucao", "finalizado"),
      transicaoPermitida("finalizado", "planejamento"),
      transicaoPermitida("solicitacao", "validacao_pcm"),
      transicaoPermitida("planejamento", "corretiva"),
    ];
    for (const r of recusas) {
      expect(r.permitida).toBe(false);
      expect(r.motivo.length).toBeGreaterThan(0);
    }
  });
});

describe("transicoes-os — status legado", () => {
  it("não se move uma OS PARA um status legado", () => {
    const r = transicaoPermitida("planejamento", "corretiva");
    expect(r.permitida).toBe(false);
    expect(r.motivo).toContain("status antigo");
  });

  it("mas se pode TIRAR a OS de um status legado — é como ela volta ao fluxo", () => {
    // Caso real: OS-0067 ("Vistoria técnica"), presa em `corretiva` desde julho.
    expect(transicaoPermitida("corretiva", "planejamento").permitida).toBe(true);
    expect(transicaoPermitida("corretiva", "validacao_pcm").permitida).toBe(true);
    expect(transicaoPermitida("backlog", "solicitacao").permitida).toBe(true);
  });

  it("reconhece quem é legado e quem é do fluxo aprovado", () => {
    expect(ehStatusLegado("corretiva")).toBe(true);
    expect(ehStatusLegado("backlog")).toBe(true);
    expect(ehStatusLegado("planejamento")).toBe(false);
    expect(ehStatusDoFluxoAprovado("validacao_pcm")).toBe(true);
    expect(ehStatusDoFluxoAprovado("corretiva")).toBe(false);
  });
});

describe("destinosPermitidos", () => {
  it("lista só o que o fluxo permite, para o seletor não oferecer o impossível", () => {
    expect(destinosPermitidos("solicitacao")).toEqual(["planejamento", "cancelado"]);
    expect(destinosPermitidos("validacao_pcm")).toEqual([
      "finalizado",
      "em_execucao",
      "planejamento",
      "cancelado",
    ]);
  });

  it("status terminal não oferece destino", () => {
    expect(destinosPermitidos("finalizado")).toEqual([]);
    expect(destinosPermitidos("cancelado")).toEqual([]);
  });

  it("nenhum destino sugerido é um status legado", () => {
    for (const de of ["solicitacao", "planejamento", "em_execucao", "validacao_pcm"] as const)
      for (const destino of destinosPermitidos(de)) expect(ehStatusLegado(destino)).toBe(false);
  });
});
