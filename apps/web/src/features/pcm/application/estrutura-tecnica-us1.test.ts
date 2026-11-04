import { describe, expect, it, vi } from "vitest";
import { moverComponente, salvarGrupoQuantitativo } from "./estrutura-tecnica";

const comando = {
  requestId: "17610000-0000-4000-8000-000000000101",
  expectedRevision: 0,
  grupoId: "17610000-0000-4000-8000-000000000061",
  localId: "17610000-0000-4000-8000-000000000031",
  categoriaId: "17610000-0000-4000-8000-000000000041",
  sistemaId: null,
  nome: " Luminárias ",
  quantidade: 20,
  caracteristicas: { potencia: "12 W" },
};

describe("salvar Grupo Quantitativo", () => {
  it("envia comando validado sem gerar unidades e preserva resultado", async () => {
    const resultado = {
      aggregateId: comando.grupoId,
      revision: 1,
      state: true,
      created: true,
      linkedIds: { localId: comando.localId },
      warnings: [],
      requestId: comando.requestId,
    };
    const gateway = { salvarGrupo: vi.fn().mockResolvedValue(resultado) };
    await expect(salvarGrupoQuantitativo(gateway, comando)).resolves.toEqual(resultado);
    expect(gateway.salvarGrupo).toHaveBeenCalledExactlyOnceWith({ ...comando, nome: "Luminárias" });
  });
  it.each([
    { quantidade: 0 },
    { quantidade: 1.5 },
    { expectedRevision: -1 },
    { localId: "outro" },
    { nome: " " },
  ])("rejeita entrada inválida antes de enviar: %o", async (alteracao) => {
    const gateway = { salvarGrupo: vi.fn() };
    await expect(salvarGrupoQuantitativo(gateway, { ...comando, ...alteracao })).rejects.toThrow();
    expect(gateway.salvarGrupo).not.toHaveBeenCalled();
  });
  it("propaga conflitos e não reenvia nem mascara falha", async () => {
    const conflito = new Error("revisao_obsoleta");
    const gateway = { salvarGrupo: vi.fn().mockRejectedValue(conflito) };
    await expect(salvarGrupoQuantitativo(gateway, comando)).rejects.toBe(conflito);
    expect(gateway.salvarGrupo).toHaveBeenCalledTimes(1);
  });
});

describe("movimentar Componente", () => {
  const mover = {
    requestId: comando.requestId,
    expectedRevision: 3,
    componenteId: comando.grupoId,
    areaId: "17610000-0000-4000-8000-000000000021",
    localId: comando.localId,
    parentId: null,
  };
  it("envia revisão e identidade originais para movimentação", async () => {
    const resultado = {
      aggregateId: mover.componenteId,
      revision: 4,
      state: true,
      created: false,
      linkedIds: { localId: mover.localId },
      warnings: [],
      requestId: mover.requestId,
    };
    const gateway = { moverComponente: vi.fn().mockResolvedValue(resultado) };
    await expect(moverComponente(gateway, mover)).resolves.toEqual(resultado);
    expect(gateway.moverComponente).toHaveBeenCalledExactlyOnceWith(mover);
  });
  it.each([{ expectedRevision: 0 }, { componenteId: "inválido" }, { areaId: null }])(
    "não envia movimentação inválida: %o",
    async (alteracao) => {
      const gateway = { moverComponente: vi.fn() };
      await expect(moverComponente(gateway, { ...mover, ...alteracao })).rejects.toThrow();
      expect(gateway.moverComponente).not.toHaveBeenCalled();
    },
  );
});
