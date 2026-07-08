import { describe, expect, it, vi } from "vitest";
import { acionarZeAgora } from "./acionar-ze-agora";
import { assumirConversa } from "./assumir-conversa";
import type { AtendimentoGateway } from "./atendimento-gateway";
import { devolverAoZe } from "./devolver-ao-ze";
import { enviarMensagem } from "./enviar-mensagem";
import { marcarConversaLida } from "./marcar-conversa-lida";

function fakeGateway(overrides: Partial<AtendimentoGateway> = {}): AtendimentoGateway {
  return {
    listarConversas: vi.fn().mockResolvedValue([]),
    listarMensagens: vi.fn().mockResolvedValue([]),
    enviarMensagem: vi.fn().mockResolvedValue({ id: "msg-1" }),
    assumirConversa: vi.fn().mockResolvedValue(undefined),
    devolverAoZe: vi.fn().mockResolvedValue(undefined),
    marcarComoLida: vi.fn().mockResolvedValue(undefined),
    acionarZeAgora: vi.fn().mockResolvedValue(undefined),
    enviarMensagemRica: vi.fn(),
    atualizarTags: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("enviarMensagem", () => {
  it("valida e delega ao gateway com o texto já normalizado", async () => {
    const gateway = fakeGateway();
    await enviarMensagem(gateway, { conversaId: "conv-1", texto: "  oi  " });
    expect(gateway.enviarMensagem).toHaveBeenCalledWith({ conversaId: "conv-1", texto: "oi" });
  });

  it("lança sem chamar o gateway quando o texto é vazio", () => {
    const gateway = fakeGateway();
    expect(() => enviarMensagem(gateway, { conversaId: "conv-1", texto: "   " })).toThrow(
      "Mensagem não pode ser vazia.",
    );
    expect(gateway.enviarMensagem).not.toHaveBeenCalled();
  });

  it("lança sem chamar o gateway quando a conversa é ausente", () => {
    const gateway = fakeGateway();
    expect(() => enviarMensagem(gateway, { conversaId: "", texto: "oi" })).toThrow(
      "Conversa é obrigatória.",
    );
    expect(gateway.enviarMensagem).not.toHaveBeenCalled();
  });
});

describe("assumirConversa / devolverAoZe / marcarConversaLida / acionarZeAgora", () => {
  it("exigem conversaId antes de delegar", () => {
    const gateway = fakeGateway();
    expect(() => assumirConversa(gateway, { conversaId: "", userId: "user-1" })).toThrow(
      "Conversa é obrigatória.",
    );
    expect(() => devolverAoZe(gateway, { conversaId: "" })).toThrow("Conversa é obrigatória.");
    expect(() => marcarConversaLida(gateway, { conversaId: "" })).toThrow(
      "Conversa é obrigatória.",
    );
    expect(() => acionarZeAgora(gateway, { conversaId: "" })).toThrow("Conversa é obrigatória.");
  });

  it("delegam ao gateway quando conversaId é válido", async () => {
    const gateway = fakeGateway();
    await assumirConversa(gateway, { conversaId: "conv-1", userId: "user-1" });
    expect(gateway.assumirConversa).toHaveBeenCalledWith({
      conversaId: "conv-1",
      userId: "user-1",
    });

    await devolverAoZe(gateway, { conversaId: "conv-1" });
    expect(gateway.devolverAoZe).toHaveBeenCalledWith({ conversaId: "conv-1" });

    await marcarConversaLida(gateway, { conversaId: "conv-1" });
    expect(gateway.marcarComoLida).toHaveBeenCalledWith({ conversaId: "conv-1" });

    await acionarZeAgora(gateway, { conversaId: "conv-1" });
    expect(gateway.acionarZeAgora).toHaveBeenCalledWith({ conversaId: "conv-1" });
  });
});
