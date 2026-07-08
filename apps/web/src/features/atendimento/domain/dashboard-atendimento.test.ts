import { describe, expect, it } from "vitest";
import { montarPainelAtendimento, montarWidgetsAtendimento } from "./dashboard-atendimento";
import type { SnapshotAtendimentoRaw } from "./dashboard-atendimento";

function fakeSnapshot(overrides: Partial<SnapshotAtendimentoRaw> = {}): SnapshotAtendimentoRaw {
  return {
    periodo: "hoje",
    filaSemAtendente: 0,
    abertas: 0,
    naoLidas: 0,
    maisAntigaNaFilaSegundos: null,
    abertasHoje: 0,
    abertasOntem: 0,
    aging: [],
    frtMedioSegundos: null,
    mixCanal: [],
    mixModo: [],
    autonomiaZe: 0,
    autonomiaHumano: 0,
    escalonadoTotal: 0,
    encerradasTotal: 0,
    encerradasSemHumano: 0,
    csatMedia: null,
    csatRespostas: 0,
    volumeDiario: [],
    slaDentroMetaPct: null,
    heatmapHora: [],
    throughput: [],
    cargaAtendente: [],
    ...overrides,
  };
}

describe("montarPainelAtendimento", () => {
  it("repassa contagens de fila direto do snapshot", () => {
    const painel = montarPainelAtendimento(
      fakeSnapshot({ filaSemAtendente: 220, abertas: 419, naoLidas: 13 }),
    );
    expect(painel.filaSemAtendente).toBe(220);
    expect(painel.conversasAbertas).toBe(419);
    expect(painel.naoLidas).toBe(13);
  });

  it("formata duração em horas e minutos", () => {
    const painel = montarPainelAtendimento(
      fakeSnapshot({ maisAntigaNaFilaSegundos: 20 * 3600 + 10 * 60 }),
    );
    expect(painel.maisAntigaNaFilaLabel).toBe("20h 10m");
  });

  it("formata duração só em minutos quando menor que 1h", () => {
    const painel = montarPainelAtendimento(fakeSnapshot({ frtMedioSegundos: 16 * 60 + 43 }));
    expect(painel.frtMedioLabel).toBe("17m"); // arredonda pro minuto mais próximo
  });

  it("duração ausente vira traço, não erro", () => {
    const painel = montarPainelAtendimento(fakeSnapshot());
    expect(painel.maisAntigaNaFilaLabel).toBe("—");
    expect(painel.frtMedioLabel).toBe("—");
  });

  it("calcula delta de abertas hoje vs ontem", () => {
    const painel = montarPainelAtendimento(fakeSnapshot({ abertasHoje: 104, abertasOntem: 159 }));
    expect(painel.abertasHojeDeltaPct).toBe(-35);
  });

  it("delta sem base ontem não divide por zero", () => {
    const painel = montarPainelAtendimento(fakeSnapshot({ abertasHoje: 5, abertasOntem: 0 }));
    expect(painel.abertasHojeDeltaPct).toBeNull();
  });

  it("preenche buckets de aging ausentes com zero, em ordem fixa", () => {
    const painel = montarPainelAtendimento(fakeSnapshot({ aging: [{ faixa: "4-24h", total: 1 }] }));
    expect(painel.aging).toEqual([
      { faixa: "0-1h", total: 0 },
      { faixa: "1-4h", total: 0 },
      { faixa: "4-24h", total: 1 },
      { faixa: "+24h", total: 0 },
    ]);
  });

  it("calcula autonomia da IA e trata zero mensagens sem dividir por zero", () => {
    const comMensagens = montarPainelAtendimento(
      fakeSnapshot({ autonomiaZe: 242, autonomiaHumano: 177 }),
    );
    expect(comMensagens.autonomiaPct).toBe(58);

    const semMensagens = montarPainelAtendimento(fakeSnapshot());
    expect(semMensagens.autonomiaPct).toBeNull();
  });

  it("calcula % de escalonamento e deflexão", () => {
    const painel = montarPainelAtendimento(
      fakeSnapshot({
        escalonadoTotal: 30,
        abertas: 419,
        encerradasTotal: 124,
        encerradasSemHumano: 0,
        csatMedia: null,
        csatRespostas: 0,
      }),
    );
    expect(painel.escalonadoPct).toBe(7);
    expect(painel.deflexaoPct).toBe(0);
  });

  it("mix de canal ordenado por total decrescente", () => {
    const painel = montarPainelAtendimento(
      fakeSnapshot({
        mixCanal: [
          { canal: "instagram", total: 5 },
          { canal: "whatsapp", total: 40 },
        ],
      }),
    );
    expect(painel.mixCanal).toEqual([
      { label: "whatsapp", total: 40 },
      { label: "instagram", total: 5 },
    ]);
  });

  it("CSAT sempre null/0 — sem tabela de pesquisa no schema ainda", () => {
    const painel = montarPainelAtendimento(fakeSnapshot());
    expect(painel.csat).toEqual({ media: null, respostas: 0 });
  });
});

describe("montarWidgetsAtendimento", () => {
  it("repassa a série de volume diário direto do snapshot", () => {
    const widgets = montarWidgetsAtendimento(
      fakeSnapshot({ volumeDiario: [{ dia: "2026-07-07", entrada: 10, saida: 8 }] }),
    );
    expect(widgets.volumeDiario).toEqual([{ dia: "2026-07-07", entrada: 10, saida: 8 }]);
  });

  it("repassa % dentro da meta de SLA", () => {
    const widgets = montarWidgetsAtendimento(fakeSnapshot({ slaDentroMetaPct: 92 }));
    expect(widgets.slaDentroMetaPct).toBe(92);
  });

  it("mapeia throughput e carga por atendente só com nome+total (sem vazar userId pra UI)", () => {
    const widgets = montarWidgetsAtendimento(
      fakeSnapshot({
        throughput: [{ userId: "u1", nome: "Ana", enviadas: 40 }],
        cargaAtendente: [{ userId: "u1", nome: "Ana", abertas: 5 }],
      }),
    );
    expect(widgets.throughput).toEqual([{ nome: "Ana", enviadas: 40 }]);
    expect(widgets.cargaAtendente).toEqual([{ nome: "Ana", abertas: 5 }]);
  });
});
