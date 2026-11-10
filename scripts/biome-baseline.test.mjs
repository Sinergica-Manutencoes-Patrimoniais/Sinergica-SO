import assert from "node:assert/strict";
import test from "node:test";
import { collect, compare } from "./biome-baseline.mjs";

const diagnostic = { category: "lint/example", severity: "error", description: "Problema", location: { path: { file: "./exemplo.ts" }, span: [1, 2] } };
const report = { summary: { diagnosticsNotPrinted: 0 }, diagnostics: [diagnostic] };
const snapshot = (source, input = report) => collect(input, () => Buffer.from(source));

test("bloqueia novo diagnóstico e arquivo alterado; aceita dívida resolvida", () => {
  const baseline = snapshot("original");
  assert.deepEqual(compare(snapshot("original"), baseline), []);
  assert.deepEqual(compare(snapshot("alterado"), baseline), ["exemplo.ts"]);
  assert.deepEqual(compare(snapshot("original", { ...report, diagnostics: [diagnostic, diagnostic] }), baseline), ["exemplo.ts"]);
  assert.deepEqual(compare({}, baseline), []);
});

test("falha fechado para relatório incompleto e diagnóstico sem arquivo", () => {
  assert.throws(() => snapshot("x", { ...report, summary: { diagnosticsNotPrinted: 1 } }));
  assert.throws(() => snapshot("x", { ...report, diagnostics: [{ ...diagnostic, location: {} }] }));
});
