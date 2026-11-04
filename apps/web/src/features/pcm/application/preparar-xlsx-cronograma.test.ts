// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { extrairXlsxEmWorker } from "../infrastructure/extrair-xlsx-worker";
import { extrairXlsxLimitado } from "../infrastructure/extrair-xlsx-limitado";
import { prepararXlsxCronograma } from "./preparar-xlsx-cronograma";

vi.mock("../infrastructure/extrair-xlsx-worker", async () => {
  const real = await import("../infrastructure/extrair-xlsx-limitado");
  return { extrairXlsxEmWorker: vi.fn(real.extrairXlsxLimitado) };
});

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

it("prepara cronograma real em memória, com matriz e avisos, sem aprovação", async () => {
  const bytes = readFileSync("../../docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const resultado = await prepararXlsxCronograma(bytes, "fonte", "cliente", new AbortController().signal);
  expect(resultado.previa.estado).toBe("conferivel");
  if (resultado.previa.estado !== "conferivel") throw new Error("prévia bloqueada");
  expect(resultado.previa.linhas).toHaveLength(59);
  expect(resultado.matriz?.[2]?.[0]).toBe("CONDOMÍNIO");
  expect(resultado.previa.avisos.length).toBeGreaterThan(0);
  expect(resultado.evidencias.find((celula) => celula.referencia === "M5")).toMatchObject({
    referencia: "M5", formula: 'COUNTIF(P5:BO5,"X")', valor: "1", tipo: "numero",
  });
  expect(resultado.matriz?.[4]?.[12]).toBeNull();
  expect(resultado.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
});

it("identifica e interpreta a mesma cópia, mesmo quando o chamador altera os bytes", async () => {
  const bytes = readFileSync("../../docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const esperado = createHash("sha256").update(bytes).digest("hex");
  const leitura = prepararXlsxCronograma(bytes, "fonte", "cliente", new AbortController().signal);
  bytes.fill(0);
  const resultado = await leitura;
  expect(resultado.sha256).toBe(esperado);
  expect(resultado.previa.estado).toBe("conferivel");
});

it("rejeita preparação cancelada sem retornar matriz", async () => {
  const abortar = new AbortController(); abortar.abort();
  await expect(prepararXlsxCronograma(new Uint8Array([1]), "fonte", "cliente", abortar.signal)).rejects.toMatchObject({ name: "AbortError" });
});

it("não disponibiliza matriz quando há fórmula em campo necessário", async () => {
  const bytes = readFileSync("../../docs/planejamento/plano-manutencao/fontes/plano-rimini-2026-final.xlsx");
  const partes = await extrairXlsxLimitado(bytes);
  const caminho = "xl/worksheets/sheet2.xml";
  const xml = new TextDecoder().decode(partes.get(caminho));
  const alterado = xml.replace(/(<x:c r="I5"[^>]*>)/, "$1<x:f>1</x:f>");
  expect(alterado).not.toBe(xml);
  partes.set(caminho, new TextEncoder().encode(alterado));
  vi.mocked(extrairXlsxEmWorker).mockResolvedValueOnce(partes);
  const resultado = await prepararXlsxCronograma(bytes, "fonte", "cliente", new AbortController().signal);
  expect(resultado.previa.estado).toBe("pendente");
  expect(resultado.matriz).toBeNull();
  expect(resultado.evidencias.find((celula) => celula.referencia === "I5")?.formula).toBe("1");
});

it("conserva os metadados da fórmula compartilhada como evidência", async () => {
  const bytes = readFileSync("../../docs/planejamento/plano-manutencao/fontes/plano-i-home-2026.xlsx");
  const resultado = await prepararXlsxCronograma(bytes, "fonte", "cliente", new AbortController().signal);
  expect(resultado.evidencias.find((celula) => celula.referencia === "N5")).toMatchObject({
    formula: 'IF(L5="","",L5/60)', valor: "0.5", formulaCompartilhada: { indice: 0, referencia: "N5:N36" },
  });
});
