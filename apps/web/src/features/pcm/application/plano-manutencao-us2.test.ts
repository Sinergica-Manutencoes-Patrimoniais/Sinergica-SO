import { describe, expect, it, vi } from "vitest";
import { aprovarPlano, iniciarRevisao, retirarRotinaRascunho } from "./plano-manutencao";

const id = "16520000-0000-4000-8000-000000000001";
const base = { requestId: id, expectedRevision: 1, planoId: id };

describe("S165 US2: revisão e aprovação", () => {
  it("propaga conflito de aprovação sem inventar recibo e repete o mesmo envelope", async () => {
    const aprovarPlanoGateway = vi.fn().mockRejectedValue(new Error("comparacao_obsoleta"));
    const comando = { ...base, vigencia: "2026-01-01" };
    await expect(aprovarPlano({ aprovarPlano: aprovarPlanoGateway }, comando)).rejects.toThrow("comparacao_obsoleta");
    await expect(aprovarPlano({ aprovarPlano: aprovarPlanoGateway }, comando)).rejects.toThrow("comparacao_obsoleta");
    expect(aprovarPlanoGateway).toHaveBeenLastCalledWith(comando);
  });
  it("rejeita vigência inválida, revisão zero e retirada sem motivo antes do gateway", async () => {
    const aprovar = vi.fn(); const iniciar = vi.fn(); const retirar = vi.fn();
    await expect(aprovarPlano({ aprovarPlano: aprovar }, { ...base, vigencia: "2026-02-30" })).rejects.toThrow();
    await expect(iniciarRevisao({ iniciarRevisao: iniciar }, { ...base, expectedRevision: 0, novaVersaoId: id })).rejects.toThrow();
    await expect(retirarRotinaRascunho({ retirarRotina: retirar }, { ...base, rotinaId: id, motivo: "  " })).rejects.toThrow();
    expect(aprovar).not.toHaveBeenCalled(); expect(iniciar).not.toHaveBeenCalled(); expect(retirar).not.toHaveBeenCalled();
  });
  it("entrega ao gateway o identificador da nova versão e preserva o recibo", async () => {
    const recibo = { aggregateId: id, revision: 2, state: "rascunho", created: true, linkedIds: { versao: id }, warnings: [], requestId: id };
    const iniciar = vi.fn().mockResolvedValue(recibo);
    const comando = { ...base, novaVersaoId: id };
    await expect(iniciarRevisao({ iniciarRevisao: iniciar }, comando)).resolves.toEqual(recibo);
    expect(iniciar).toHaveBeenCalledWith(comando);
  });
});
