import { DOMParser } from "@xmldom/xmldom";
import { expect, it } from "vitest";
import type { EstadoEstrutura } from "../domain/importacao-estrutura";
import { gerarExportacaoEstruturaXlsx } from "./exportar-estrutura-xlsx";
import { extrairXlsxLimitado } from "./extrair-xlsx-limitado";

const idArea = "a4f97bd8-e3ef-4b42-8a47-1bdce909f32f";
const nomeArea = "Área de equipamentos do condomínio de teste";
const descricao = "Inspeção da sala de bombas. ".repeat(7).trim();

const estado: EstadoEstrutura = {
  cliente: { id: "cliente", nome: "Condomínio fictício" },
  areas: [
    { id: idArea, clienteId: "cliente", nome: nomeArea, ordem: 15, descricao: null, ativo: true },
  ],
  locais: [],
  sistemas: [
    {
      id: "sistema",
      clienteId: "cliente",
      nome: "Sistema de pressurização",
      categoria: "Hidráulica",
      areaId: idArea,
      localId: null,
      descricao,
      ativo: true,
      categoriaId: null,
      tipo: null,
      auvoId: null,
      auvoEquipmentId: null,
      codigo: "0001",
      auvoSyncStatus: null,
      auvoSyncError: null,
      auvoSyncedAt: null,
    },
  ],
  componentes: [],
  membros: [],
  categorias: [{ id: "categoria", nome: "Hidráulica", sigla: "HID" }],
  tiposLocal: [],
};

it("exporta as abas e dados de estrutura com larguras legíveis e quebra das descrições longas", async () => {
  const blob = await gerarExportacaoEstruturaXlsx(estado);
  const arquivos = await extrairXlsxLimitado(new Uint8Array(await blob.arrayBuffer()));
  const texto = (caminho: string) => new TextDecoder().decode(arquivos.get(caminho));
  const xml = (caminho: string) =>
    new DOMParser().parseFromString(texto(caminho), "application/xml");
  const abas = xml("xl/workbook.xml").getElementsByTagName("sheet");
  expect(Array.from(abas, (aba) => aba.getAttribute("name"))).toEqual([
    "Leia-me",
    "Áreas",
    "Locais",
    "Sistemas",
    "Componentes",
    "Listas",
  ]);
  const areas = xml("xl/worksheets/sheet2.xml");
  const largurasAreas = Array.from(areas.getElementsByTagName("col"), (col) =>
    Number(col.getAttribute("width")),
  );
  expect(largurasAreas[1]).toBeGreaterThanOrEqual(idArea.length);
  expect(largurasAreas[2]).toBeGreaterThanOrEqual(nomeArea.length);
  const sistemas = xml("xl/worksheets/sheet4.xml");
  const largurasSistemas = Array.from(sistemas.getElementsByTagName("col"), (col) =>
    Number(col.getAttribute("width")),
  );
  expect(largurasSistemas[7]).toBeGreaterThanOrEqual(50);
  expect(largurasSistemas[7]).toBeLessThan(descricao.length);
  const estilos = xml("xl/styles.xml").getElementsByTagName("cellXfs").item(0);
  const celulas = Array.from(sistemas.getElementsByTagName("c"));
  const celulaDescricao = celulas.find((celula) => celula.getAttribute("r") === "H2");
  expect(celulaDescricao).toBeDefined();
  const estilo = estilos
    ?.getElementsByTagName("xf")
    .item(Number(celulaDescricao?.getAttribute("s")));
  expect(estilo?.getElementsByTagName("alignment").item(0)?.getAttribute("wrapText")).toBe("1");
  expect(texto("xl/sharedStrings.xml")).toContain(descricao);
  expect(texto("xl/sharedStrings.xml")).toContain(idArea);
  expect(texto("xl/sharedStrings.xml")).toContain(nomeArea);
  expect(texto("xl/sharedStrings.xml")).toContain("0001");
  const ordem = Array.from(areas.getElementsByTagName("c")).find(
    (celula) => celula.getAttribute("r") === "E2",
  );
  expect(ordem?.getElementsByTagName("v").item(0)?.textContent).toBe("15");
});
