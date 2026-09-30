import { describe, expect, it } from "vitest";
import {
  type EntradaPrefixo,
  SiglasFaltantesError,
  montarIdentificador,
  montarPrefixoIdentificador,
  normalizarIdentificadorManual,
} from "./identificador-ativo";

const entradaBase: EntradaPrefixo = {
  cliente: { id: "cliente", nome: "Guainumbí", sigla: "GUA" },
  area: null,
  locais: [],
  categoria: { id: "categoria", nome: "Elétrica", sigla: "ELE" },
  nomeAtivo: "Quadro Geral",
};

describe("montarPrefixoIdentificador", () => {
  it.each([
    [
      "compõe todos os níveis e separa o número do nome",
      {
        ...entradaBase,
        area: { id: "area", nome: "Torre A", sigla: "TOA" },
        locais: [
          { id: "local-1", nome: "2º Andar", sigla: "A02" },
          { id: "local-2", nome: "Shaft", sigla: "SHA" },
        ],
        nomeAtivo: "Quadro de Distribuição de Circuitos 01",
      },
      { prefixo: "GUA-TOA-A02-SHA-ELE-QDC", numeroDoNome: "01" },
    ],
    ["omite Área e Local ausentes", entradaBase, { prefixo: "GUA-ELE-QUG", numeroDoNome: null }],
    [
      "usa o número final de Portão",
      {
        ...entradaBase,
        area: { id: "area", nome: "Garagem", sigla: "GAR" },
        categoria: { id: "categoria", nome: "Segurança", sigla: "SEG" },
        nomeAtivo: "Portão 1",
      },
      { prefixo: "GUA-GAR-SEG-POR", numeroDoNome: "01" },
    ],
    [
      "mantém a regra de sigla para nome composto",
      {
        ...entradaBase,
        area: { id: "area", nome: "Torre B", sigla: "TOB" },
        categoria: { id: "categoria", nome: "PCI", sigla: "PCI" },
        nomeAtivo: "Sistema de Hidrante Torre A",
      },
      { prefixo: "GUA-TOB-PCI-SHT", numeroDoNome: null },
    ],
    [
      "preserva o caminho completo de Locais",
      {
        ...entradaBase,
        area: { id: "area", nome: "Torre A", sigla: "TOA" },
        locais: [
          { id: "local-1", nome: "Térreo", sigla: "TER" },
          { id: "local-2", nome: "Banheiro", sigla: "BAN" },
        ],
        categoria: { id: "categoria", nome: "Hidráulica", sigla: "HID" },
        nomeAtivo: "Ar Condicionado 2",
      },
      { prefixo: "GUA-TOA-TER-BAN-HID-ARC", numeroDoNome: "02" },
    ],
  ] as const)("%s", (_descricao, entrada, esperado) => {
    expect(montarPrefixoIdentificador(entrada)).toEqual(esperado);
  });

  it.each([
    ["cliente", { ...entradaBase, cliente: { ...entradaBase.cliente, sigla: null } }],
    ["area", { ...entradaBase, area: { id: "area", nome: "Torre A", sigla: null } }],
    [
      "local",
      {
        ...entradaBase,
        locais: [{ id: "local", nome: "Shaft", sigla: null }],
      },
    ],
    ["categoria", { ...entradaBase, categoria: { ...entradaBase.categoria, sigla: null } }],
  ] as const)("informa a sigla faltante de %s", (nivel, entrada) => {
    expect(() => montarPrefixoIdentificador(entrada)).toThrow(SiglasFaltantesError);
    try {
      montarPrefixoIdentificador(entrada);
    } catch (erro) {
      expect(erro).toBeInstanceOf(SiglasFaltantesError);
      expect((erro as SiglasFaltantesError).faltantes).toEqual([
        expect.objectContaining({ nivel }),
      ]);
    }
  });
});

describe("montarIdentificador", () => {
  it("acrescenta o sequencial ao prefixo", () => {
    expect(montarIdentificador("GUA-ELE-QUG", "01")).toBe("GUA-ELE-QUG-01");
  });
});

describe("normalizarIdentificadorManual", () => {
  it("remove extremidades e coloca em caixa alta", () => {
    expect(normalizarIdentificadorManual(" gua-ele-qdc-01 ")).toBe("GUA-ELE-QDC-01");
  });

  it.each(["", "   ", "GUA ELE-QDC-01"])('rejeita "%s"', (valor) => {
    expect(() => normalizarIdentificadorManual(valor)).toThrow("Identificador inválido.");
  });
});
