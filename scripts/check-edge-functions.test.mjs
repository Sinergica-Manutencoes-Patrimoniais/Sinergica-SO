import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const SCRIPT = resolve("scripts/check-edge-functions.mjs");

function fixture({ folder = true, declared = true, invoke = "literal" } = {}) {
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
        : "supabase.functions.invoke(nome)";
  writeFileSync(join(root, "apps", "web", "src", "adapter.ts"), call);
  return root;
}

function run(root) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, root], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: stdout };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout?.toString() ?? ""}${error.stderr?.toString() ?? ""}`,
    };
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
});
