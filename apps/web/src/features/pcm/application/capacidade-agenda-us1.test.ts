import { expect, it } from "vitest";
import { conferirBaseCapacidade, consultarResumoCapacidade } from "./capacidade-agenda";

const pedido = { clienteId: "c1", semanaInicio: "2026-12-28", semanaFim: "2027-01-03" };
const cobertura = {
  disponibilidade: true,
  reservasAusencias: true,
  demandas: true,
  visitas: true,
  vinculacoes: true,
  qualificacoes: true,
};

it("calcula saldo da semana com demandas identificadas e disponibilidade informada", async () => {
  const resultado = await consultarResumoCapacidade(
    {
      consultar: async () => ({
        ...pedido,
        cobertura,
        disponibilidade: { destinadosMinutos: 720, reservasMinutos: 0, ausenciasMinutos: 0 },
        demandas: [
          { origemId: "oc-1", minutosInternos: 720 },
          { origemId: "oc-2", minutosInternos: 180 },
        ],
      }),
    },
    pedido,
  );
  expect(resultado).toMatchObject({
    disponiveisMinutos: 720,
    demandaConhecidaMinutos: 900,
    saldoMinutos: -180,
    demandasSemEstimativa: 0,
  });
});

it("não apresenta saldo quando disponibilidade ou estimativa faltam e rejeita duplicidade", async () => {
  const base = {
    ...pedido,
    cobertura,
    disponibilidade: { destinadosMinutos: 720, reservasMinutos: 0, ausenciasMinutos: 0 },
    demandas: [{ origemId: "oc-1", minutosInternos: null }],
  };
  expect(await consultarResumoCapacidade({ consultar: async () => base }, pedido)).toMatchObject({
    saldoMinutos: null,
    demandasSemEstimativa: 1,
  });
  expect(
    await consultarResumoCapacidade(
      {
        consultar: async () => ({
          ...base,
          disponibilidade: { ...base.disponibilidade, reservasMinutos: null },
        }),
      },
      pedido,
    ),
  ).toMatchObject({ saldoMinutos: null });
  await expect(
    consultarResumoCapacidade(
      { consultar: async () => ({ ...base, demandas: [base.demandas[0]!, base.demandas[0]!] }) },
      pedido,
    ),
  ).rejects.toThrow(/duplicada/i);
});

it("não apresenta saldo quando esforço de uma origem é zero e permanece não estimado", async () => {
  const resultado = await consultarResumoCapacidade({ consultar: async () => ({
    ...pedido, cobertura,
    disponibilidade: { destinadosMinutos: 720, reservasMinutos: 0, ausenciasMinutos: 0 },
    demandas: [{ origemId: "terceiro-sem-acompanhamento", minutosInternos: 0 }],
  }) }, pedido);
  expect(resultado).toMatchObject({ demandaConhecidaMinutos: 0, demandasSemEstimativa: 1, saldoMinutos: null });
});

it("aceita somente base coerente e identifica fontes ausentes", async () => {
  const resultado = await conferirBaseCapacidade(
    {
      consultar: async () => ({ ...pedido, cobertura: { ...cobertura, reservasAusencias: false } }),
    },
    pedido,
  );
  expect(resultado).toEqual({ situacao: "incompleta", fontesPendentes: ["reservasAusencias"] });
});

it("recusa resposta de outro Cliente ou período", async () => {
  await expect(
    conferirBaseCapacidade(
      { consultar: async () => ({ ...pedido, clienteId: "c2", cobertura }) },
      pedido,
    ),
  ).rejects.toThrow(/contexto/i);
  await expect(
    conferirBaseCapacidade(
      { consultar: async () => ({ ...pedido, semanaFim: "2027-01-02", cobertura }) },
      pedido,
    ),
  ).rejects.toThrow(/contexto/i);
});

it("não apresenta disponibilidade completa quando fonte falha", async () => {
  await expect(
    conferirBaseCapacidade(
      {
        consultar: async () => {
          throw new Error("fonte indisponível");
        },
      },
      pedido,
    ),
  ).rejects.toThrow("fonte indisponível");
});

it("exige semana civil completa de segunda a domingo", async () => {
  const invalido = { ...pedido, semanaFim: "2027-01-02" };
  await expect(
    conferirBaseCapacidade({ consultar: async () => ({ ...invalido, cobertura }) }, invalido),
  ).rejects.toThrow(/semana/i);
});

it("descarta resposta que chega após cancelamento", async () => {
  const controle = new AbortController();
  await expect(
    conferirBaseCapacidade(
      {
        consultar: async () => {
          controle.abort();
          return { ...pedido, cobertura };
        },
      },
      pedido,
      controle.signal,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
});

it("não permite que o gateway altere o contexto esperado", async () => {
  const contexto = { ...pedido };
  await expect(
    conferirBaseCapacidade(
      {
        consultar: async (recebido) => {
          recebido.clienteId = "c2";
          return { ...recebido, cobertura };
        },
      },
      contexto,
    ),
  ).rejects.toThrow(/contexto/i);
  expect(contexto.clienteId).toBe("c1");
});
