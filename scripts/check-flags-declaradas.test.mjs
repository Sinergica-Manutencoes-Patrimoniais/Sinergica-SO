import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { extrairRegistro, varrer } from "./check-flags-declaradas.mjs";

function fixture({ registro, arquivo }) {
  const root = mkdtempSync(join(tmpdir(), "flags-gate-"));
  const dirSrc = join(root, "src");
  mkdirSync(dirSrc, { recursive: true });
  const caminhoRegistro = join(dirSrc, "flags-sso.ts");
  writeFileSync(caminhoRegistro, registro);
  writeFileSync(join(dirSrc, "Componente.tsx"), arquivo);
  return { root, dirSrc, caminhoRegistro };
}

test("extrairRegistro lê os nomes declarados no formato real do arquivo", () => {
  const nomes = extrairRegistro(
    "export const FLAGS_SSO = [\n" +
      "  { nome: 'VITE_SSO_A_ENABLED', padrao: false, jornada: 'outra', descricao: 'a' },\n" +
      "  { nome: 'VITE_SSO_B_ENABLED', padrao: false, jornada: 'outra', gate: 'x.y', descricao: 'b' },\n" +
      "];\n",
  );
  assert.deepEqual([...nomes].sort(), ["VITE_SSO_A_ENABLED", "VITE_SSO_B_ENABLED"]);
});

test("varrer não acusa flag lida que já está declarada", () => {
  const { dirSrc, caminhoRegistro } = fixture({
    registro: "export const FLAGS_SSO = [{ nome: 'VITE_SSO_X_ENABLED', padrao: false, jornada: 'outra', descricao: 'x' }];\n",
    arquivo: 'const ligado = flagLigada("VITE_SSO_X_ENABLED");\n',
  });
  const { lidas, fugaDoRegistro } = varrer([dirSrc], caminhoRegistro);
  assert.ok(lidas.has("VITE_SSO_X_ENABLED"));
  assert.equal(fugaDoRegistro.length, 0);
});

test("varrer acusa flag lida e não declarada (condição 1, AC-1)", () => {
  const { dirSrc, caminhoRegistro } = fixture({
    registro: "export const FLAGS_SSO = [];\n",
    arquivo: 'const v = import.meta.env.VITE_SSO_NOVA_ENABLED;\n',
  });
  const declaradas = extrairRegistro("export const FLAGS_SSO = [];\n");
  const { lidas } = varrer([dirSrc], caminhoRegistro);
  assert.ok(lidas.has("VITE_SSO_NOVA_ENABLED"));
  assert.ok(!declaradas.has("VITE_SSO_NOVA_ENABLED"));
});

test("varrer acusa leitura direta de import.meta.env fora do registro (fuga)", () => {
  const { dirSrc, caminhoRegistro } = fixture({
    registro: "export const FLAGS_SSO = [{ nome: 'VITE_SSO_X_ENABLED', padrao: false, jornada: 'outra', descricao: 'x' }];\n",
    arquivo: 'if (import.meta.env.VITE_SSO_X_ENABLED === "true") {}\n',
  });
  const { fugaDoRegistro } = varrer([dirSrc], caminhoRegistro);
  assert.equal(fugaDoRegistro.length, 1);
});

test("varrer não acusa fuga dentro do próprio arquivo de registro", () => {
  const root = mkdtempSync(join(tmpdir(), "flags-gate-"));
  const dirSrc = join(root, "src");
  mkdirSync(dirSrc, { recursive: true });
  const caminhoRegistro = join(dirSrc, "flags-sso.ts");
  writeFileSync(
    caminhoRegistro,
    "export const FLAGS_SSO = [{ nome: 'VITE_SSO_X_ENABLED', padrao: false, jornada: 'outra', descricao: 'x' }];\n" +
      'export function flagLigada(n) { return import.meta.env[n] === "true"; }\n',
  );
  const { fugaDoRegistro } = varrer([dirSrc], caminhoRegistro);
  assert.equal(fugaDoRegistro.length, 0);
});

test("varrer acusa construção dinâmica de nome de flag (caminho de fuga)", () => {
  const { dirSrc, caminhoRegistro } = fixture({
    registro: "export const FLAGS_SSO = [];\n",
    arquivo: "const v = import.meta.env[`VITE_SSO_${x}_ENABLED`];\n",
  });
  const { construcaoDinamica } = varrer([dirSrc], caminhoRegistro);
  assert.equal(construcaoDinamica.length, 1);
});

test("varrer ignora arquivo .test.tsx", () => {
  const root = mkdtempSync(join(tmpdir(), "flags-gate-"));
  const dirSrc = join(root, "src");
  mkdirSync(dirSrc, { recursive: true });
  const caminhoRegistro = join(dirSrc, "flags-sso.ts");
  writeFileSync(caminhoRegistro, "export const FLAGS_SSO = [];\n");
  writeFileSync(join(dirSrc, "Componente.test.tsx"), 'const v = import.meta.env.VITE_SSO_SO_TESTE_ENABLED;\n');
  const { lidas } = varrer([dirSrc], caminhoRegistro);
  assert.equal(lidas.has("VITE_SSO_SO_TESTE_ENABLED"), false);
});
