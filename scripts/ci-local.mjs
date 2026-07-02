#!/usr/bin/env node
// Espelho local da CI — roda a MESMA sequência de gates que .github/workflows/ci.yml, na mesma
// ordem, e para no primeiro que falhar (fail-fast, como a CI). É o que o hook pre-push executa:
// o objetivo é que NADA que passe aqui quebre no pipeline. Rode à mão a qualquer momento:
//   pnpm run ci:local
//
// Filosofia (ver PADRAO-DE-QUALIDADE.md): "pronto" é gate verde por comando. Este script é o
// comando único que prova isso localmente antes do push.
//
// Gates opcionais (build, test:e2e) entram AUTOMATICAMENTE se o projeto os declarar em
// package.json > scripts — sem editar este arquivo. Local roda a suíte COMPLETA (não o
// "affected" que a CI usa pra velocidade) — o objetivo aqui é certeza antes do push, não rapidez.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const has = (script) => Boolean(pkg.scripts?.[script]);

// Ordem = ordem da CI (job qualidade + job migrations). `optional` não derruba o push se a
// ferramenta não estiver instalada.
const steps = [
  { name: "Auditoria da esteira", cmd: "pnpm run audit:esteira" },
  { name: "Fidelidade spec→task", cmd: "pnpm run eval:spec" },
  { name: "Diagramas Mermaid", cmd: "node scripts/validate-mermaid.mjs" },
  { name: "Lint de migrations", cmd: "pnpm run lint:migrations" },
  { name: "Lint/format (Biome)", cmd: "pnpm run lint" },
  { name: "Type-check", cmd: "pnpm run typecheck" },
  { name: "Arquitetura (DDD)", cmd: "pnpm run arch:check" },
  has("build") && { name: "Build", cmd: "pnpm run build" },
  { name: "Testes", cmd: "pnpm test" },
  has("test:e2e") && { name: "E2E (Playwright)", cmd: "pnpm run test:e2e" },
  // Secret scanning é best-effort local: o gate BLOQUEANTE de verdade é o da CI. Aqui só avisa
  // se o gitleaks estiver instalado — não trava o push de quem não tem o binário.
  {
    name: "Secret scanning (gitleaks, se instalado)",
    cmd: "gitleaks detect --source . --no-banner --redact --exit-code 1",
    optional: true,
  },
].filter(Boolean);

const isInstalled = (bin) => {
  try {
    execSync(process.platform === "win32" ? `where ${bin}` : `command -v ${bin}`, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

console.log("▶ ci:local — espelho da CI (pare no primeiro vermelho, como o pipeline)\n");
const skipped = [];
let step = 0;
for (const s of steps) {
  step++;
  if (s.optional && s.cmd.startsWith("gitleaks") && !isInstalled("gitleaks")) {
    skipped.push(`${s.name} — gitleaks não instalado (a CI cobre este gate)`);
    console.log(`… [${step}/${steps.length}] ${s.name}: pulado (ferramenta ausente)\n`);
    continue;
  }
  console.log(`→ [${step}/${steps.length}] ${s.name}`);
  try {
    execSync(s.cmd, { stdio: "inherit" });
    console.log(`✓ ${s.name}\n`);
  } catch {
    if (s.optional) {
      skipped.push(`${s.name} — falhou mas é opcional local`);
      console.log(`… ${s.name}: opcional, seguindo\n`);
      continue;
    }
    console.error(`\n✗ FALHOU: ${s.name}`);
    console.error("  Corrija antes de fazer push — este mesmo gate reprova o pipeline.\n");
    process.exit(1);
  }
}

// db-tests (pgTAP via Docker) não entra aqui: exige Docker local, que nem todo mundo tem — é
// por isso que esse gate roda no CI (runner já tem Docker), não no pre-push. Ver
// docs/STATE.md e specs/E00-S05-autenticacao-autorizacao/tasks.md.
if (isInstalled("docker") && isInstalled("supabase")) {
  skipped.push(
    "db-tests (pgTAP) — Docker e Supabase CLI disponíveis; rode `supabase start && supabase test db` manualmente se mexeu em migrations/RLS",
  );
} else {
  skipped.push("db-tests (pgTAP) — requer Docker local; a CI cobre este gate (job db-tests)");
}

if (skipped.length) {
  console.log("Avisos (não bloqueiam o push, mas a CI cobre):");
  for (const w of skipped) console.log(`  • ${w}`);
  console.log("");
}
console.log("✓ ci:local verde — seguro para push. O pipeline deve refletir este resultado.");
