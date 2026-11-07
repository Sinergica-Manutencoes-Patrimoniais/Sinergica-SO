import { describe, expect, it, vi } from "vitest";
import { moverComponente, salvarGrupoQuantitativo } from "./estrutura-tecnica";
import type { EstruturaTecnicaGateway, MovimentarComponenteGateway, ResultadoEstrutura } from "./estrutura-tecnica-gateway";

const uuid = (sufixo: string) => `17600000-0000-4000-8000-0000000000${sufixo}`;
const command = {
  requestId: uuid("01"), expectedRevision: 0, grupoId: uuid("02"), localId: uuid("03"),
  categoriaId: uuid("04"), sistemaId: uuid("05"), nome: "Luminárias do salão", quantidade: 20,
  caracteristicas: { Potência: "12 W", Tipo: "LED" },
};
const receipt: ResultadoEstrutura = {
  aggregateId: command.grupoId, revision: 1, state: true, created: true,
  linkedIds: { clienteId: uuid("06"), localId: command.localId, sistemaId: command.sistemaId },
  warnings: [], requestId: command.requestId,
};

describe("E01-S176 US1 — commands", () => {
  it("salva um Grupo Quantitativo como agregado único e retorna o recibo idempotente", async () => {
    const gateway: EstruturaTecnicaGateway = { salvarGrupo: vi.fn().mockResolvedValue(receipt) };
    const first = await salvarGrupoQuantitativo(gateway, command);
    const replay = await salvarGrupoQuantitativo(gateway, command);
    expect(gateway.salvarGrupo).toHaveBeenNthCalledWith(1, command);
    expect(gateway.salvarGrupo).toHaveBeenNthCalledWith(2, command);
    expect(first).toBe(receipt);
    expect(replay).toBe(receipt);
    expect(first.linkedIds.sistemaId).toBe(command.sistemaId);
  });

  it.each([
    { quantidade: 0 },
    { quantidade: 1.5 },
    { nome: "  " },
    { localId: "not-a-uuid" },
  ])("não envia grupo inválido ao gateway (%o)", async (alteracao) => {
    const gateway: EstruturaTecnicaGateway = { salvarGrupo: vi.fn() };
    await expect(salvarGrupoQuantitativo(gateway, { ...command, ...alteracao })).rejects.toThrow();
    expect(gateway.salvarGrupo).not.toHaveBeenCalled();
  });

  it("preserva edição se o servidor rejeita Cliente/revisão em vez de confirmar sucesso", async () => {
    const conflito = Object.assign(new Error("Revisão obsoleta"), { code: "40001" });
    const gateway: EstruturaTecnicaGateway = { salvarGrupo: vi.fn().mockRejectedValue(conflito) };
    await expect(salvarGrupoQuantitativo(gateway, command)).rejects.toBe(conflito);
    expect(gateway.salvarGrupo).toHaveBeenCalledTimes(1);
  });

  it("exige Área quando o destino é Local e usa a revisão declarada ao mover Componente", async () => {
    const mover = vi.fn().mockResolvedValue(receipt);
    const gateway: MovimentarComponenteGateway = { moverComponente: mover };
    const move = {
      requestId: uuid("11"), expectedRevision: 3, componenteId: uuid("12"),
      areaId: uuid("13"), localId: uuid("14"), parentId: uuid("15"),
    };
    await moverComponente(gateway, move);
    expect(mover).toHaveBeenCalledWith(move);
    await expect(moverComponente(gateway, { ...move, areaId: null })).rejects.toThrow(
      "Informe a Área do Local.",
    );
  });
});
