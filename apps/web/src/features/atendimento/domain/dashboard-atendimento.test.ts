import { describe, expect, it } from "vitest";
import type { ConversaItem } from "./conversas";
import { montarDashboardAtendimento } from "./dashboard-atendimento";

function fakeConversa(overrides: Partial<ConversaItem> = {}): ConversaItem {
  return {
    id: "conv-1",
    clientId: "cli-1",
    clienteNome: "Condomínio Alpha",
    contatoNome: "Síndico João",
    canal: "whatsapp",
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

const AGORA = new Date("2026-07-07T12:00:00.000Z");

describe("montarDashboardAtendimento", () => {
  it("conta conversas abertas, não lidas e assumidas por humano", () => {
    const conversas = [
      fakeConversa({ id: "c1", naoLidas: 3 }),
      fakeConversa({ id: "c2", modo: "pausado", naoLidas: 0 }),
      fakeConversa({ id: "c3", status: "encerrada", naoLidas: 5 }),
    ];
    const resumo = montarDashboardAtendimento(conversas, { ze: 0, humano: 0 }, AGORA);
    const abertas = resumo.kpis.find((k) => k.label === "Conversas abertas");
    expect(abertas?.valor).toBe("2");
    expect(abertas?.sub).toBe("3 não lidas");
    const assumidas = resumo.kpis.find((k) => k.label === "Assumidas por humano");
    expect(assumidas?.valor).toBe("1");
  });

  it("marca conversas abertas paradas há 24h+ como aging", () => {
    const conversas = [
      fakeConversa({ id: "c1", ultimaMensagemEm: "2026-07-06T10:00:00.000Z" }),
      fakeConversa({ id: "c2", ultimaMensagemEm: "2026-07-07T11:00:00.000Z" }),
    ];
    const resumo = montarDashboardAtendimento(conversas, { ze: 0, humano: 0 }, AGORA);
    expect(resumo.kpis.find((k) => k.label === "Paradas há 24h+")?.valor).toBe("1");
  });

  it("calcula autonomia da IA a partir das mensagens de saída", () => {
    const resumo = montarDashboardAtendimento([], { ze: 8, humano: 2 }, AGORA);
    const autonomia = resumo.kpis.find((k) => k.label === "Autonomia da IA");
    expect(autonomia?.valor).toBe("80%");
    expect(autonomia?.sub).toBe("8/10 respostas do Zé");
  });

  it("sem mensagens de saída mostra traço em vez de dividir por zero", () => {
    const resumo = montarDashboardAtendimento([], { ze: 0, humano: 0 }, AGORA);
    expect(resumo.kpis.find((k) => k.label === "Autonomia da IA")?.valor).toBe("—");
  });

  it("agrupa mix de canais e top tags", () => {
    const conversas = [
      fakeConversa({ id: "c1", canal: "whatsapp", tags: ["urgente"] }),
      fakeConversa({ id: "c2", canal: "whatsapp", tags: ["urgente", "orcamento"] }),
      fakeConversa({ id: "c3", canal: "instagram", tags: [] }),
    ];
    const resumo = montarDashboardAtendimento(conversas, { ze: 0, humano: 0 }, AGORA);
    expect(resumo.mixCanais).toEqual([
      { canal: "whatsapp", total: 2 },
      { canal: "instagram", total: 1 },
    ]);
    expect(resumo.topTags[0]).toEqual({ nome: "urgente", total: 2 });
  });
});
