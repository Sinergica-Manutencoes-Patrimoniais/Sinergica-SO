import { describe, expect, it } from "vitest";
import { filtrarConversas } from "./conversas";
import type { ConversaItem } from "./conversas";

function fakeConversa(overrides: Partial<ConversaItem> = {}): ConversaItem {
  return {
    id: "conv-1",
    clientId: null,
    clienteNome: "Condomínio Alpha",
    contatoNome: "Síndico João",
    status: "aberta",
    modo: "auto",
    atribuidoA: null,
    naoLidas: 0,
    ultimaMensagemPreview: "vazamento no 3º andar",
    ultimaMensagemEm: "2026-07-07T10:00:00.000Z",
    ordemServicoId: null,
    tags: [],
    ...overrides,
  };
}

describe("filtrarConversas", () => {
  it("sem filtro devolve tudo", () => {
    const conversas = [fakeConversa(), fakeConversa({ id: "conv-2" })];
    expect(filtrarConversas(conversas)).toHaveLength(2);
  });

  it("filtra por status", () => {
    const conversas = [
      fakeConversa({ id: "conv-1", status: "aberta" }),
      fakeConversa({ id: "conv-2", status: "encerrada" }),
    ];
    expect(filtrarConversas(conversas, { status: "aberta" }).map((c) => c.id)).toEqual(["conv-1"]);
  });

  it("busca casa contra cliente, contato e preview, ignorando acento/caixa", () => {
    const conversas = [fakeConversa({ clienteNome: "Condomínio São José" })];
    expect(filtrarConversas(conversas, { busca: "sao jose" })).toHaveLength(1);
    expect(filtrarConversas(conversas, { busca: "vazamento" })).toHaveLength(1);
    expect(filtrarConversas(conversas, { busca: "nada a ver" })).toHaveLength(0);
  });
});
