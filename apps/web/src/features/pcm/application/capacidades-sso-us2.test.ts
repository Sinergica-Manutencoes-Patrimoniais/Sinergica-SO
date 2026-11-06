import { describe, expect, it, vi } from "vitest";
import { definirConcessao } from "./capacidades-sso";
import type { CapacidadesSsoGateway } from "./capacidades-sso-gateway";

const comando = { requestId: "17020000-0000-4000-8000-000000000101", expectedRevision: 3,
  usuarioId: "17020000-0000-4000-8000-000000000002", perfilId: null,
  acao: "plano.gerir" as const, clienteId: "17020000-0000-4000-8000-00000000000a",
  ativa: true, motivo: "Gestão individual do Plano" };

describe("comando de concessão para gestão", () => {
  it("não executa concessão de gestão por perfil ou com motivo vazio", async () => {
    const enviar = vi.fn(); const gateway = { definirConcessao: enviar } as unknown as CapacidadesSsoGateway;
    await expect(definirConcessao(gateway, { ...comando, usuarioId: null, perfilId: comando.usuarioId })).rejects.toThrow();
    await expect(definirConcessao(gateway, { ...comando, motivo: "  " })).rejects.toThrow();
    expect(enviar).not.toHaveBeenCalled();
  });
  it("preserva requestId, revisão e Cliente ao repetir após resposta incerta", async () => {
    const falha = new Error("resposta incerta");
    const enviar = vi.fn().mockRejectedValueOnce(falha).mockResolvedValueOnce({ requestId: comando.requestId });
    const gateway = { definirConcessao: enviar } as unknown as CapacidadesSsoGateway;
    await expect(definirConcessao(gateway, comando)).rejects.toBe(falha);
    await definirConcessao(gateway, comando);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar).toHaveBeenNthCalledWith(1, comando);
    expect(enviar).toHaveBeenNthCalledWith(2, comando);
  });
  it("propaga erro de escopo do servidor sem fabricar recibo", async () => {
    const negado = Object.assign(new Error("sem acesso"), { code: "42501" });
    const enviar = vi.fn().mockRejectedValue(negado);
    const gateway = { definirConcessao: enviar } as unknown as CapacidadesSsoGateway;
    await expect(definirConcessao(gateway, comando)).rejects.toBe(negado);
  });
});
