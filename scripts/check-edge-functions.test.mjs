import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const SCRIPT = resolve("scripts/check-edge-functions.mjs");

function fixture({ folder = true, declared = true, invoke = "literal", source } = {}) {
  const root = mkdtempSync(join(tmpdir(), "edge-gate-"));
  mkdirSync(join(root, "supabase", "functions"), { recursive: true });
  mkdirSync(join(root, "apps", "web", "src"), { recursive: true });
  if (folder) mkdirSync(join(root, "supabase", "functions", "demo"));
  writeFileSync(
    join(root, "supabase", "config.toml"),
    declared ? "[functions.demo]\nverify_jwt = true\n" : "",
  );
  const call =
    invoke === "literal"
      ? 'supabase.functions.invoke("demo")'
      : invoke === "missing"
        ? 'supabase.functions.invoke("ausente")'
        : invoke === "multiline"
          ? 'supabase.functions.invoke(\n  "demo")'
          : invoke === "generic-missing"
            ? 'supabase.functions.invoke<Blob>("ausente")'
          : invoke === "generic-nested"
            ? 'supabase.functions.invoke<Resposta<Blob>>("demo")'
          : invoke === "generic-dynamic"
            ? 'supabase.functions.invoke<Blob>(nome)'
          : invoke === "concatenated"
            ? 'supabase.functions.invoke("demo" + suffix)'
          : invoke === "template"
            ? 'supabase.functions.invoke(`demo-${suffix}`)'
          : "supabase.functions.invoke(nome)";
  writeFileSync(join(root, "apps", "web", "src", "adapter.ts"), source ?? call);
  return root;
}

function run(root) {
  try {
    const result = spawnSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
    if (result.error) throw result.error;
    return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("aceita função existente, declarada e invocada", () => {
  assert.equal(run(fixture()).ok, true);
});

test("falha para pasta sem declaração", () => {
  const result = run(fixture({ declared: false }));
  assert.equal(result.ok, false);
  assert.match(result.output, /Função órfã/);
});

test("falha para invoke literal sem pasta", () => {
  const result = run(fixture({ invoke: "missing" }));
  assert.equal(result.ok, false);
  assert.match(result.output, /não corresponde/);
});

test("invoke dinâmico é aviso, não falso positivo", () => {
  const result = run(fixture({ invoke: "dynamic" }));
  assert.equal(result.ok, true);
  assert.match(result.output, /nome dinâmico/);
});

test("invoke literal em múltiplas linhas não gera aviso dinâmico", () => {
  const result = run(fixture({ invoke: "multiline" }));
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.output, /nome dinâmico/);
  assert.match(result.output, /1 invoke\(s\) verificado\(s\)/);
});

test("invoke com genérico verifica função ausente", () => {
  const result = run(fixture({ invoke: "generic-missing" }));
  assert.equal(result.ok, false);
  assert.match(result.output, /não corresponde/);
});

test("invoke com genérico aninhado verifica literal", () => {
  const result = run(fixture({ invoke: "generic-nested" }));
  assert.equal(result.ok, true);
  assert.match(result.output, /1 invoke\(s\) verificado\(s\)/);
});

test("invoke com genérico e nome dinâmico mantém aviso", () => {
  const result = run(fixture({ invoke: "generic-dynamic" }));
  assert.equal(result.ok, true);
  assert.match(result.output, /nome dinâmico/);
});

for (const invoke of ["concatenated", "template"]) {
  test(`invoke ${invoke} não é confundido com nome literal`, () => {
    const result = run(fixture({ invoke }));
    assert.equal(result.ok, true);
    assert.match(result.output, /nome dinâmico/);
    assert.match(result.output, /0 invoke\(s\) verificado\(s\)/);
  });
}


test("ignora texto e comentários e identifica duas chamadas genéricas", () => {
  const source = `
    // functions.invoke<Blob>("ausente-comentario")
    const texto = 'functions.invoke("ausente-texto")';
    supabase.functions.invoke<Blob>("demo");
    supabase.functions.invoke<Resposta<Blob>>("ausente-real");
  `;
  const result = run(fixture({ source }));
  assert.equal(result.ok, false);
  assert.match(result.output, /ausente-real/);
  assert.doesNotMatch(result.output, /ausente-comentario|ausente-texto/);
});

test("tipo genérico com função e comentário não oculta chamada", () => {
  const source = `supabase.functions.invoke<{ fn: () => string }>("ausente-real");`;
  const result = run(fixture({ source }));
  assert.equal(result.ok, false);
  assert.match(result.output, /ausente-real/);
});
