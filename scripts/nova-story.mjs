#!/usr/bin/env node
/**
 * pnpm nova-story
 * Registra uma nova story no ROADMAP.md, cria a pasta specs/E0N-S0N-<nome>/
 * com spec.md e tasks.md a partir dos templates, e grava .current-story.
 *
 * Uso: pnpm nova-story
 * O script faz perguntas interativas via stdin.
 */
import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROADMAP = resolve(ROOT, "docs/epics/ROADMAP.md");
const SPECS_DIR = resolve(ROOT, "specs");
const TEMPLATES_DIR = resolve(ROOT, "specs/_templates");
const STORY_FILE = resolve(ROOT, ".current-story");

const rl = createInterface({ input: process.stdin, output: process.stdout });

// ─── helpers ──────────────────────────────────────────────────────────────────

function pad2(n) {
  return String(n).padStart(2, "0");
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readTemplate(name) {
  const path = join(TEMPLATES_DIR, name);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

// ─── coleta de dados ──────────────────────────────────────────────────────────

console.log("\n╔══════════════════════════════════════════════╗");
console.log("║  📋 NOVA STORY — Sinérgica OS               ║");
console.log("╚══════════════════════════════════════════════╝\n");
console.log("Preencha os dados da story. Isso registrará no ROADMAP e criará os arquivos de spec.\n");

const epicNum = await rl.question("Épico (número, ex: 01): ");
const storyNum = await rl.question("Story (número dentro do épico, ex: 03): ");
const descricao = await rl.question("Descrição curta da story (ex: listagem de ordens de serviço): ");
const owner = await rl.question("Owner (seu nome, ex: Lucas / João / Claude): ");
const tier = await rl.question("Tier [trivial/pequeno/arquitetural] (Enter = pequeno): ");

rl.close();

const epicId = `E${pad2(epicNum.trim())}`;
const storyId = `S${pad2(storyNum.trim())}`;
const fullId = `${epicId}-${storyId}`;
const tierFinal = ["trivial", "pequeno", "arquitetural"].includes(tier.trim().toLowerCase())
  ? tier.trim().toLowerCase()
  : "pequeno";
const slug = slugify(descricao);
const specDir = join(SPECS_DIR, `${fullId}-${slug}`);
const specPath = join(specDir, "spec.md");
const tasksPath = join(specDir, "tasks.md");

console.log(`\n→ Story ID: ${fullId}`);
console.log(`→ Pasta:    specs/${fullId}-${slug}/`);
console.log(`→ Tier:     ${tierFinal}`);
console.log(`→ Owner:    ${owner}\n`);

// ─── verificações ──────────────────────────────────────────────────────────────

if (existsSync(specDir)) {
  console.error(`❌ Pasta ${specDir} já existe. A story pode já estar registrada.`);
  process.exit(1);
}

// ─── criar arquivos ───────────────────────────────────────────────────────────

mkdirSync(specDir, { recursive: true });

// spec.md
const specTemplate = readTemplate("spec.template.md");
const specContent = specTemplate
  ? specTemplate
      .replace(/\{\{STORY_ID\}\}/g, fullId)
      .replace(/\{\{DESCRICAO\}\}/g, descricao)
      .replace(/\{\{TIER\}\}/g, tierFinal)
      .replace(/\{\{SLUG\}\}/g, slug)
  : `---
name: spec-${fullId}-${slug}
description: ${descricao}
alwaysApply: false
---

# Spec — ${fullId}: ${descricao}

> Épico: ${epicId} · Tier: ${tierFinal} · Status: **rascunho**

## Resumo
<!-- Descreva o objetivo da story em 2-3 frases. -->

## Critérios de aceite (AC)

### AC-1: [Título]
- Dado ...
- Quando ...
- Então ...

## Fora de escopo (VINCULANTE)
-

## Rastreabilidade
- Tasks: [tasks.md](tasks.md)
- Épico: [ROADMAP.md](../../docs/epics/ROADMAP.md)
`;

writeFileSync(specPath, specContent, "utf8");

// tasks.md
const tasksTemplate = readTemplate("tasks.template.md");
const tasksContent = tasksTemplate
  ? tasksTemplate
      .replace(/\{\{STORY_ID\}\}/g, fullId)
      .replace(/\{\{DESCRICAO\}\}/g, descricao)
  : `---
name: tasks-${fullId}-${slug}
description: Tasks da story ${fullId}: ${descricao}
alwaysApply: false
---

# Tasks — ${fullId}: ${descricao}

## Plano
| # | Task | Cobre AC | Gate | Status |
|----|------|----------|------|--------|
| 1 | | AC-1 | | ⬜ todo |

## Checklist de Definition of Done
- [ ] \`pnpm typecheck\` limpo
- [ ] \`pnpm lint\` limpo
- [ ] \`pnpm test\` verde
- [ ] Spec e tasks atualizados
- [ ] Story marcada como Implementado no ROADMAP
- [ ] \`docs/STATE.md\` atualizado
`;

writeFileSync(tasksPath, tasksContent, "utf8");

// ─── registrar no ROADMAP ─────────────────────────────────────────────────────

const roadmapContent = readFileSync(ROADMAP, "utf8");
const epicSection = `### ${epicId} —`;

const storyRow = `| ${fullId} | ${descricao} | [spec](../../specs/${fullId}-${slug}/spec.md) | Rascunho | ${owner} | ⏳ |`;

let updatedRoadmap;
if (roadmapContent.includes(epicSection)) {
  // Insere no final da tabela do épico
  const insertAfter = `| Story ID | Descrição | Spec | Status | Owner | AC verdes |`;
  const headerLine = `|----------|-----------|------|--------|-------|-----------|`;
  const insertPoint = roadmapContent.indexOf(headerLine, roadmapContent.indexOf(epicSection));
  if (insertPoint !== -1) {
    // Encontra o fim da tabela (linha em branco ou próxima seção)
    let end = insertPoint + headerLine.length;
    while (end < roadmapContent.length) {
      const nextNewline = roadmapContent.indexOf("\n", end + 1);
      if (nextNewline === -1) break;
      const nextLine = roadmapContent.slice(end + 1, nextNewline + 1).trim();
      if (!nextLine.startsWith("|")) break;
      end = nextNewline;
    }
    updatedRoadmap =
      roadmapContent.slice(0, end + 1) + storyRow + "\n" + roadmapContent.slice(end + 1);
  } else {
    // fallback: append ao final da seção do épico
    updatedRoadmap = roadmapContent.replace(
      epicSection,
      `${epicSection}\n${storyRow}\n`,
    );
  }
} else {
  console.warn(`⚠️  Seção "${epicSection}" não encontrada no ROADMAP. Adicione manualmente:`);
  console.warn(`   ${storyRow}`);
  updatedRoadmap = roadmapContent;
}

writeFileSync(ROADMAP, updatedRoadmap, "utf8");

// ─── .current-story ───────────────────────────────────────────────────────────

writeFileSync(STORY_FILE, fullId, "utf8");

// ─── resultado ────────────────────────────────────────────────────────────────

console.log("✅ Story registrada com sucesso!\n");
console.log(`  Spec:   specs/${fullId}-${slug}/spec.md`);
console.log(`  Tasks:  specs/${fullId}-${slug}/tasks.md`);
console.log(`  ROADMAP atualizado com owner: ${owner}`);
console.log(`  .current-story → ${fullId}\n`);
console.log("Próximos passos obrigatórios:");
console.log("  1. Edite spec.md — escreva os ACs em Given/When/Then");
console.log("  2. Edite tasks.md — quebre em tasks com referência de AC");
console.log(`  3. Commits devem ter escopo: feat(${fullId}): descrição`);
console.log("  4. Ao concluir: marque AC verdes no ROADMAP + atualize docs/STATE.md");
console.log("\n  Agentes recomendados: @pm → @sm → @dev → @qa → @devops\n");
