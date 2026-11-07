import { describe, expect, it, vi } from "vitest";
import type { EquipamentoItem } from "../domain/equipamentos";
import { obterDetalheAtivo, type DetalheAtivo } from "./board-ativos";
import type { BoardAtivosGateway } from "./board-ativos-gateway";
import type { EquipamentosGateway } from "./equipamentos-gateway";
import { listarMembrosSistemasDoCliente, listarItensDoSistema } from "./sistemas";
import type { SistemasGateway } from "./sistemas-gateway";

describe("E01-S176 US2 — leitura por Local e Sistema", () => {
  it("consulta composição sob o Cliente selecionado e preserva Local de cada membro", async () => {
    const membros = [
      { id: "m1", sistemaId: "s1", itemId: "i-norte", itemNome: "Extintor Norte", itemClienteId: "c1" },
      { id: "m2", sistemaId: "s1", itemId: "i-sul", itemNome: "Extintor Sul", itemClienteId: "c1" },
    ];
    const gateway = {
      listarMembrosDoCliente: vi.fn().mockResolvedValue(membros),
      listarItensDoSistema: vi.fn().mockResolvedValue(membros),
    } as unknown as SistemasGateway;
    await expect(listarMembrosSistemasDoCliente(gateway, "c1")).resolves.toEqual(membros);
    await expect(listarItensDoSistema(gateway, "s1")).resolves.toEqual(membros);
    expect(gateway.listarMembrosDoCliente).toHaveBeenCalledWith("c1");
    expect(gateway.listarItensDoSistema).toHaveBeenCalledWith("s1");
  });

  it("mantém contexto físico quando histórico falha, sem inventar eventos", async () => {
    const contexto = {
      item: { id: "item-1" } as unknown as EquipamentoItem,
      breadcrumb: { clienteNome: "Cliente A", areaNome: "Torre A", localNome: "Hall Norte" },
      sistemas: [{ id: "sistema-1", nome: "Extintores", codigo: "PCI-01" }],
      componentesFilhos: [],
    } as Awaited<ReturnType<EquipamentosGateway["obterContextoItem"]>>;
    const equipamentos = { obterContextoItem: vi.fn().mockResolvedValue(contexto) } as unknown as EquipamentosGateway;
    const board = { listarHistoricoOsItem: vi.fn().mockRejectedValue(new Error("indisponível")) } as unknown as BoardAtivosGateway;
    const detalhe: DetalheAtivo = await obterDetalheAtivo(equipamentos, board, "item-1");
    expect(detalhe.contexto).toBe(contexto);
    expect(detalhe.historicoOs).toBeNull();
    expect(equipamentos.obterContextoItem).toHaveBeenCalledWith("item-1");
    expect(board.listarHistoricoOsItem).toHaveBeenCalledWith("item-1");
  });

  it("distingue histórico vazio de histórico indisponível", async () => {
    const contexto = {
      item: {} as unknown as EquipamentoItem,
      breadcrumb: null,
      sistemas: [],
      componentesFilhos: [],
    };
    const equipamentos = { obterContextoItem: vi.fn().mockResolvedValue(contexto) } as unknown as EquipamentosGateway;
    const board = { listarHistoricoOsItem: vi.fn().mockResolvedValue([]) } as unknown as BoardAtivosGateway;
    const detalhe = await obterDetalheAtivo(equipamentos, board, "item-sem-os");
    expect(detalhe.historicoOs).toEqual([]);
    expect(detalhe.historicoOs).not.toBeNull();
  });
});
