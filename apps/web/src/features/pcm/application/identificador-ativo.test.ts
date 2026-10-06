import { describe, expect, it } from "vitest";
import {
  prepararIdentificadorNaCriacao,
  previsualizarIdentificador,
  resolverIdentificadorNaCriacao,
} from "./identificador-ativo";
import type { IdentificadorAtivoGateway, NiveisIdentificador } from "./identificador-ativo-gateway";

const niveis: NiveisIdentificador = {
  cliente: { id: "cliente", nome: "Guainumbí", sigla: "GUA" },
  area: { id: "area", nome: "Torre A", sigla: "TOA" },
  locais: [{ id: "local", nome: "Shaft", sigla: "SHA" }],
  categoria: { id: "categoria", nome: "Elétrica", sigla: "ELE" },
};

function gatewayFake(niveisIniciais = niveis) {
  let atual = niveisIniciais;
  const escritas: string[] = [];
  const gateway: IdentificadorAtivoGateway = {
    obterNiveis: async () => atual,
    definirSigla: async (nivel, id, sigla) => {
      escritas.push(`${nivel}:${id}:${sigla}`);
      if (nivel === "cliente") atual = { ...atual, cliente: { ...atual.cliente, sigla } };
    },
    proximoSequencial: async () => "04",
  };
  return { gateway, escritas };
}

const input = {
  clienteId: "cliente",
  areaId: "area",
  localId: "local",
  categoriaId: "categoria",
  nomeAtivo: "Quadro Geral",
};

describe("identificador de ativo", () => {
  it("pré-visualiza o próximo sequencial sem reservá-lo", async () => {
    const { gateway } = gatewayFake();
    await expect(previsualizarIdentificador(gateway, input)).resolves.toEqual({
      prefixo: "GUA-TOA-SHA-ELE-QUG",
      nn: "04",
      faltantes: [],
    });
  });

  it("recalcula a prévia com as siglas aceitas sem gravá-las", async () => {
    const { gateway, escritas } = gatewayFake({
      ...niveis,
      cliente: { ...niveis.cliente, sigla: null },
    });

    await expect(
      previsualizarIdentificador(gateway, input, [
        { nivel: "cliente", id: "cliente", sigla: "GUA" },
      ]),
    ).resolves.toEqual({
      prefixo: "GUA-TOA-SHA-ELE-QUG",
      nn: "04",
      faltantes: [],
    });
    expect(escritas).toEqual([]);
  });

  it("grava siglas informadas, recarrega níveis e reserva o sequencial", async () => {
    const { gateway, escritas } = gatewayFake({
      ...niveis,
      cliente: { ...niveis.cliente, sigla: null },
    });
    await expect(
      resolverIdentificadorNaCriacao(gateway, input, {
        siglasInformadas: [{ nivel: "cliente", id: "cliente", sigla: "GUA" }],
        identificadorManual: null,
        userId: "usuario",
      }),
    ).resolves.toEqual({ identificador: "GUA-TOA-SHA-ELE-QUG-04", nnDoSequencial: true });
    expect(escritas).toEqual(["cliente:cliente:GUA"]);
  });

  it("prioriza o identificador manual normalizado", async () => {
    const { gateway, escritas } = gatewayFake();
    await expect(
      resolverIdentificadorNaCriacao(gateway, input, {
        siglasInformadas: [],
        identificadorManual: " gua-manual ",
        userId: "usuario",
      }),
    ).resolves.toEqual({ identificador: "GUA-MANUAL", nnDoSequencial: false });
    expect(escritas).toEqual([]);
  });

  it("compensa as siglas já persistidas se uma sugestão posterior falhar", async () => {
    let atual: NiveisIdentificador = {
      ...niveis,
      cliente: { ...niveis.cliente, sigla: null },
      area: { id: "area", nome: "Torre A", sigla: null },
    };
    const escritas: string[] = [];
    const gateway: IdentificadorAtivoGateway = {
      obterNiveis: async () => atual,
      definirSigla: async (nivel, id, sigla) => {
        escritas.push(`${nivel}:${id}:${sigla}`);
        if (nivel === "cliente") atual = { ...atual, cliente: { ...atual.cliente, sigla } };
        if (nivel === "area" && sigla === "TOA") throw new Error("falha ao salvar área");
      },
      proximoSequencial: async () => "04",
    };

    await expect(
      prepararIdentificadorNaCriacao(gateway, input, {
        siglasInformadas: [
          { nivel: "cliente", id: "cliente", sigla: "GUA" },
          { nivel: "area", id: "area", sigla: "TOA" },
        ],
        identificadorManual: null,
        userId: "usuario",
      }),
    ).rejects.toThrow("falha ao salvar área");

    expect(escritas).toEqual(["cliente:cliente:GUA", "area:area:TOA", "cliente:cliente:null"]);
    expect(atual.cliente.sigla).toBeNull();
  });
});
