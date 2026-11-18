import { describe, expect, it } from "vitest";
import {
  COLUNAS_KANBAN_PADRAO,
  alternarVisibilidadeColuna,
  labelColunaKanban,
  moverColuna,
  normalizarColunasKanban,
} from "./kanban-colunas";

describe("kanban-colunas", () => {
  it("normalizarColunasKanban — sem preferência salva cai pro padrão", () => {
    expect(normalizarColunasKanban(null)).toEqual(COLUNAS_KANBAN_PADRAO);
    expect(normalizarColunasKanban([])).toEqual(COLUNAS_KANBAN_PADRAO);
  });

  it("normalizarColunasKanban — preserva ordem/visibilidade salva e descarta ids desconhecidos", () => {
    const salvas = [
      { id: "planejamento" as const, visivel: false },
      { id: "solicitacao" as const, visivel: true },
      { id: "coluna-que-nao-existe-mais" as never, visivel: true },
    ];
    const resultado = normalizarColunasKanban(salvas);
    expect(resultado[0]).toEqual({ id: "planejamento", visivel: false });
    expect(resultado[1]).toEqual({ id: "solicitacao", visivel: true });
    expect(resultado.some((c) => (c.id as string) === "coluna-que-nao-existe-mais")).toBe(false);
  });

  it("normalizarColunasKanban — coluna nova (ex: preventiva) some da preferência antiga é reincluída no fim", () => {
    const salvasSemPreventiva = COLUNAS_KANBAN_PADRAO.filter((c) => c.id !== "preventiva");
    const resultado = normalizarColunasKanban(salvasSemPreventiva);
    expect(resultado.some((c) => c.id === "preventiva")).toBe(true);
    expect(resultado.at(-1)?.id).toBe("preventiva");
  });

  it("moverColuna — troca com a vizinha, no-op nas bordas", () => {
    const colunas = [
      { id: "solicitacao" as const, visivel: true },
      { id: "corretiva" as const, visivel: true },
      { id: "preventiva" as const, visivel: true },
    ];
    expect(moverColuna(colunas, "corretiva", "cima").map((c) => c.id)).toEqual([
      "corretiva",
      "solicitacao",
      "preventiva",
    ]);
    expect(moverColuna(colunas, "solicitacao", "cima")).toEqual(colunas);
    expect(moverColuna(colunas, "preventiva", "baixo")).toEqual(colunas);
  });

  it("alternarVisibilidadeColuna — troca só a coluna alvo", () => {
    const colunas = [
      { id: "solicitacao" as const, visivel: true },
      { id: "corretiva" as const, visivel: true },
    ];
    const resultado = alternarVisibilidadeColuna(colunas, "corretiva");
    expect(resultado).toEqual([
      { id: "solicitacao", visivel: true },
      { id: "corretiva", visivel: false },
    ]);
  });

  it("labelColunaKanban — status real usa STATUS_OS, virtual usa rótulo próprio", () => {
    expect(labelColunaKanban("planejamento")).toBe("Planejamento");
    expect(labelColunaKanban("preventiva")).toBe("Preventiva");
    expect(labelColunaKanban("demanda")).toBe("Demanda");
    expect(labelColunaKanban("validacao_pcm")).toBe("Validação PCM");
  });

  it("E01-S194 AC-1: COLUNAS_KANBAN_PADRAO é exatamente o quadro aprovado, nessa ordem", () => {
    expect(COLUNAS_KANBAN_PADRAO.map((c) => c.id)).toEqual([
      "solicitacao",
      "preventiva",
      "demanda",
      "planejamento",
      "em_execucao",
      "validacao_pcm",
      "finalizado",
    ]);
  });

  it("E01-S194 AC-2/AC-3: backlog (painel lateral) e cancelado (filtro/histórico) não são coluna cotidiana", () => {
    expect(COLUNAS_KANBAN_PADRAO.some((c) => c.id === "backlog")).toBe(false);
    expect(COLUNAS_KANBAN_PADRAO.some((c) => c.id === "cancelado")).toBe(false);
    expect(COLUNAS_KANBAN_PADRAO.some((c) => c.id === "corretiva")).toBe(false);
  });

  it("E01-S194: preferência salva antes desta story (com corretiva/backlog/cancelado) não ressuscita a coluna extinta", () => {
    const salvasAntigas = [
      { id: "solicitacao" as const, visivel: true },
      { id: "corretiva" as const, visivel: true },
      { id: "backlog" as const, visivel: true },
      { id: "cancelado" as const, visivel: true },
    ];
    const resultado = normalizarColunasKanban(salvasAntigas);
    expect(resultado.some((c) => c.id === "corretiva")).toBe(false);
    expect(resultado.some((c) => c.id === "backlog")).toBe(false);
    expect(resultado.some((c) => c.id === "cancelado")).toBe(false);
    expect(resultado.some((c) => c.id === "demanda")).toBe(true);
    expect(resultado.some((c) => c.id === "validacao_pcm")).toBe(true);
  });
});
