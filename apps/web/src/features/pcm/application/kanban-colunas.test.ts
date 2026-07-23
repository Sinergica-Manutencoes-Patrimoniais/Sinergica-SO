import { describe, expect, it, vi } from "vitest";
import { COLUNAS_KANBAN_PADRAO } from "../domain/kanban-colunas";
import { obterPreferenciaColunas, salvarPreferenciaColunas } from "./kanban-colunas";
import type { KanbanColunasGateway } from "./kanban-colunas-gateway";

describe("kanban-colunas (use case)", () => {
  it("obterPreferenciaColunas — normaliza o que o gateway devolve", async () => {
    const gateway: KanbanColunasGateway = {
      obterPreferencia: vi.fn(async () => []),
      salvarPreferencia: vi.fn(),
    };
    expect(await obterPreferenciaColunas(gateway, "user-1")).toEqual(COLUNAS_KANBAN_PADRAO);
  });

  it("obterPreferenciaColunas — repassa preferência salva já normalizada", async () => {
    const salvas = [
      { id: "corretiva" as const, visivel: false },
      { id: "solicitacao" as const, visivel: true },
    ];
    const gateway: KanbanColunasGateway = {
      obterPreferencia: vi.fn(async () => salvas),
      salvarPreferencia: vi.fn(),
    };
    const resultado = await obterPreferenciaColunas(gateway, "user-1");
    expect(resultado[0]).toEqual({ id: "corretiva", visivel: false });
    expect(resultado.length).toBe(COLUNAS_KANBAN_PADRAO.length);
  });

  it("salvarPreferenciaColunas — repassa ao gateway com o userId", async () => {
    const gateway: KanbanColunasGateway = {
      obterPreferencia: vi.fn(),
      salvarPreferencia: vi.fn(async () => undefined),
    };
    await salvarPreferenciaColunas(gateway, "user-1", COLUNAS_KANBAN_PADRAO);
    expect(gateway.salvarPreferencia).toHaveBeenCalledWith("user-1", COLUNAS_KANBAN_PADRAO);
  });
});
