import { describe, expect, it, vi } from "vitest";
import type { HistoricoChamadoSnapshot, MensagemSnapshot } from "../domain/historico-chamado";
import {
  criarChamadoRapido,
  enviarHistoricoParaChamado,
  listarChamadosDoCliente,
  listarSnapshotsDoChamado,
} from "./historico-chamado";
import type { HistoricoChamadoGateway } from "./historico-chamado-gateway";

const MENSAGEM: MensagemSnapshot = {
  id: "msg-1",
  remetenteTipo: "cliente",
  conteudo: "Oi, preciso de ajuda",
  tipoConteudo: "texto",
  midiaUrl: null,
  createdAt: "2026-07-20T10:00:00Z",
};

const SNAPSHOT: HistoricoChamadoSnapshot = {
  id: "snap-1",
  conversaId: "conv-1",
  chamadoId: "cha-1",
  janelaDias: 7,
  dataInicio: "2026-07-14T12:00:00Z",
  dataFim: "2026-07-21T12:00:00Z",
  mensagens: [MENSAGEM],
  totalMensagens: 1,
  createdAt: "2026-07-21T12:00:00Z",
};

function gatewayFake(mensagens: MensagemSnapshot[] = [MENSAGEM]): HistoricoChamadoGateway {
  return {
    listarChamadosDoCliente: vi.fn(async () => [
      { id: "cha-1", numero: "CH-0001", titulo: "Vazamento", status: "aberto" },
    ]),
    criarChamadoRapido: vi.fn(async (clienteId, titulo) => ({
      id: "cha-novo",
      numero: "CH-0002",
      titulo,
      status: "aberto",
    })),
    listarMensagensDaJanela: vi.fn(async () => mensagens),
    salvarSnapshot: vi.fn(async () => SNAPSHOT),
    listarSnapshotsDoChamado: vi.fn(async () => [SNAPSHOT]),
  };
}

describe("historico-chamado (use case)", () => {
  it("listarChamadosDoCliente repassa ao gateway", async () => {
    const gateway = gatewayFake();
    await listarChamadosDoCliente(gateway, "cli-1");
    expect(gateway.listarChamadosDoCliente).toHaveBeenCalledWith("cli-1");
  });

  it("criarChamadoRapido normaliza o título antes de persistir", async () => {
    const gateway = gatewayFake();
    await criarChamadoRapido(gateway, "cli-1", "  Vazamento  ", "user-1");
    expect(gateway.criarChamadoRapido).toHaveBeenCalledWith("cli-1", "Vazamento", "user-1");
  });

  it("criarChamadoRapido rejeita sem título", async () => {
    const gateway = gatewayFake();
    await expect(criarChamadoRapido(gateway, "cli-1", "  ", "user-1")).rejects.toThrow(/Título/);
    expect(gateway.criarChamadoRapido).not.toHaveBeenCalled();
  });

  describe("enviarHistoricoParaChamado", () => {
    it("AC-1: busca mensagens da janela e salva o snapshot", async () => {
      const gateway = gatewayFake();
      const resultado = await enviarHistoricoParaChamado(gateway, {
        conversaId: "conv-1",
        chamadoId: "cha-1",
        janelaDias: 7,
        userId: "user-1",
      });
      expect(gateway.listarMensagensDaJanela).toHaveBeenCalledWith(
        "conv-1",
        expect.any(String),
        expect.any(String),
      );
      expect(gateway.salvarSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ conversaId: "conv-1", chamadoId: "cha-1", janelaDias: 7 }),
      );
      expect(resultado).toEqual(SNAPSHOT);
    });

    it("caso de borda: janela sem mensagens rejeita sem salvar", async () => {
      const gateway = gatewayFake([]);
      await expect(
        enviarHistoricoParaChamado(gateway, {
          conversaId: "conv-1",
          chamadoId: "cha-1",
          janelaDias: 7,
          userId: "user-1",
        }),
      ).rejects.toThrow(/Nenhuma mensagem/);
      expect(gateway.salvarSnapshot).not.toHaveBeenCalled();
    });
  });

  it("listarSnapshotsDoChamado repassa ao gateway", async () => {
    const gateway = gatewayFake();
    await listarSnapshotsDoChamado(gateway, "cha-1");
    expect(gateway.listarSnapshotsDoChamado).toHaveBeenCalledWith("cha-1");
  });
});
