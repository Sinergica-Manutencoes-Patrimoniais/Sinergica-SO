import { describe, expect, it, vi } from "vitest";
import type { Sistema } from "../domain/sistemas";
import { IdentificadorDuplicadoError } from "./identificador-ativo";
import type { IdentificadorAtivoGateway } from "./identificador-ativo-gateway";
import {
  adicionarItem,
  criarSistema,
  listarHistoricoOsSistema,
  salvarComposicaoSistema,
} from "./sistemas";
import type { SistemaItemOpcao, SistemasGateway } from "./sistemas-gateway";

const SISTEMA: Sistema = {
  id: "sis-1",
  clienteId: "cli-1",
  areaId: null,
  localId: null,
  nome: "Sistema Hidrante",
  categoriaId: "cat-1",
  categoria: "Hidráulica",
  tipo: null,
  descricao: null,
  ativo: true,
  auvoId: null,
  auvoEquipmentId: null,
  codigo: null,
  auvoSyncStatus: null,
  auvoSyncError: null,
  auvoSyncedAt: null,
};

const ITENS: SistemaItemOpcao[] = [
  { id: "item-1", nome: "Bomba 1", clientId: "cli-1", sistemaId: null, sistemaNome: null },
  { id: "item-2", nome: "Bomba 2", clientId: "cli-1", sistemaId: null, sistemaNome: null },
  { id: "item-3", nome: "Bomba 3", clientId: "cli-1", sistemaId: null, sistemaNome: null },
  {
    id: "item-4",
    nome: "Bomba 4",
    clientId: "cli-1",
    sistemaId: "sis-2",
    sistemaNome: "Sistema Incêndio",
  },
];

function gatewayFake(membrosIniciais: string[]): SistemasGateway {
  const membros = new Map(
    membrosIniciais.map((itemId) => [
      itemId,
      { id: itemId, sistemaId: "sis-1", itemId, itemNome: "x", itemClienteId: "cli-1" },
    ]),
  );
  return {
    listar: vi.fn(),
    obter: vi.fn(async () => SISTEMA),
    criar: vi.fn(),
    editar: vi.fn(),
    desativar: vi.fn(),
    listarItensDisponiveis: vi.fn(async () => ITENS),
    listarItensDoSistema: vi.fn(async () => [...membros.values()]),
    adicionarItem: vi.fn(async (_sistemaId, itemId) => {
      const membro = {
        id: itemId,
        sistemaId: "sis-1",
        itemId,
        itemNome: "x",
        itemClienteId: "cli-1",
      };
      membros.set(itemId, membro);
      return membro;
    }),
    removerItem: vi.fn(async (_sistemaId, itemId) => {
      membros.delete(itemId);
    }),
    listarHistoricoOsSistema: vi.fn(async () => []),
  };
}

describe("salvarComposicaoSistema", () => {
  it("adiciona os itens marcados que ainda não pertenciam ao sistema", async () => {
    const gateway = gatewayFake(["item-1"]);
    await salvarComposicaoSistema(gateway, "sis-1", ["item-1", "item-2"], "user-1");
    expect(gateway.adicionarItem).toHaveBeenCalledWith("sis-1", "item-2", "user-1");
    expect(gateway.removerItem).not.toHaveBeenCalled();
  });

  it("remove os itens desmarcados que pertenciam ao sistema", async () => {
    const gateway = gatewayFake(["item-1", "item-2"]);
    await salvarComposicaoSistema(gateway, "sis-1", ["item-1"], "user-1");
    expect(gateway.removerItem).toHaveBeenCalledWith("sis-1", "item-2");
    expect(gateway.adicionarItem).not.toHaveBeenCalled();
  });

  it("sem mudança nenhuma, não chama nem adicionar nem remover", async () => {
    const gateway = gatewayFake(["item-1"]);
    await salvarComposicaoSistema(gateway, "sis-1", ["item-1"], "user-1");
    expect(gateway.adicionarItem).not.toHaveBeenCalled();
    expect(gateway.removerItem).not.toHaveBeenCalled();
  });
});

describe("criarSistema — E01-S157", () => {
  it("refaz uma única reserva quando o sequencial colide", async () => {
    const gateway = gatewayFake([]);
    gateway.criar = vi
      .fn()
      .mockRejectedValueOnce(new IdentificadorDuplicadoError("GUA-HID-SIH-01"))
      .mockResolvedValue(SISTEMA);
    const identificador: IdentificadorAtivoGateway = {
      obterNiveis: vi.fn(async () => ({
        cliente: { id: "cli-1", nome: "Guainumbí", sigla: "GUA" },
        area: null,
        locais: [],
        categoria: { id: "cat-1", nome: "Hidráulica", sigla: "HID" },
      })),
      definirSigla: vi.fn(),
      proximoSequencial: vi.fn().mockResolvedValueOnce("01").mockResolvedValueOnce("02"),
    };
    await criarSistema(
      gateway,
      { clienteId: "cli-1", categoriaId: "cat-1", nome: "Sistema Hidrante", userId: "user-1" },
      { identificador, siglasInformadas: [], identificadorManual: null },
    );
    expect(gateway.criar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ codigo: "GUA-HID-SIH-01" }),
    );
    expect(gateway.criar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ codigo: "GUA-HID-SIH-02" }),
    );
  });
});

describe("adicionarItem — E01-S154 AC-4", () => {
  it("rejeita item que já pertence a outro Sistema, sem chamar o gateway", async () => {
    const gateway = gatewayFake([]);
    await expect(adicionarItem(gateway, "sis-1", "item-4", "user-1")).rejects.toThrow(
      "Componente já pertence ao Sistema «Sistema Incêndio». Remova de lá antes.",
    );
    expect(gateway.adicionarItem).not.toHaveBeenCalled();
  });

  it("aceita item sem Sistema nenhum", async () => {
    const gateway = gatewayFake([]);
    await adicionarItem(gateway, "sis-1", "item-1", "user-1");
    expect(gateway.adicionarItem).toHaveBeenCalledWith("sis-1", "item-1", "user-1");
  });
});

describe("listarHistoricoOsSistema", () => {
  it("repassa o histórico do gateway", async () => {
    const historico = [
      {
        osId: "os-1",
        numero: "OS-0001",
        categoria: "corretiva",
        status: "finalizado",
        data: "2026-07-01",
      },
    ];
    const gateway = gatewayFake([]);
    gateway.listarHistoricoOsSistema = vi.fn(async () => historico);
    expect(await listarHistoricoOsSistema(gateway, "sis-1")).toEqual(historico);
  });

  it("AC-3: degrada pra null em falha de infra, sem derrubar quem chama", async () => {
    const gateway = gatewayFake([]);
    gateway.listarHistoricoOsSistema = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await listarHistoricoOsSistema(gateway, "sis-1")).toBeNull();
  });
});
