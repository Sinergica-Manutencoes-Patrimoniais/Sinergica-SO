import { describe, expect, it, vi } from "vitest";
import { adicionarRotina, salvarPlanoRascunho } from "./plano-manutencao";

const id = "16510000-0000-4000-8000-000000000001";
const plano = { requestId: id, expectedRevision: 0, planoId: id, clienteId: id, nome: "Plano" };
const rotina = { requestId: id, expectedRevision: 1, planoId: id, rotinaId: id, nome: "Inspeção", alvoTipo: "sistema" as const, alvoId: id, modo: "calendario" as const, intervalo: 1, unidade: "meses" as const, dataBase: "2026-01-01", tempoMinutos: null };

describe("S165 US1: comandos", () => {
  it("envia mesmo pedido em repetição e propaga falha do servidor", async () => {
    const salvarPlano = vi.fn().mockRejectedValue(new Error("sem_acesso"));
    await expect(salvarPlanoRascunho({ salvarPlano }, plano)).rejects.toThrow("sem_acesso");
    await expect(salvarPlanoRascunho({ salvarPlano }, plano)).rejects.toThrow("sem_acesso");
    expect(salvarPlano).toHaveBeenCalledTimes(2);
    expect(salvarPlano).toHaveBeenLastCalledWith(plano);
  });
  it("não envia Cliente ou recorrência malformados", async () => {
    const salvarPlano = vi.fn(); const adicionarRotinaGateway = vi.fn();
    await expect(salvarPlanoRascunho({ salvarPlano }, { ...plano, clienteId: "inválido" })).rejects.toThrow();
    await expect(adicionarRotina({ adicionarRotina: adicionarRotinaGateway }, { ...rotina, unidade: null })).rejects.toThrow();
    expect(salvarPlano).not.toHaveBeenCalled(); expect(adicionarRotinaGateway).not.toHaveBeenCalled();
  });
});
