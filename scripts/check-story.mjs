#!/usr/bin/env node
/**
 * Hook PreToolUse (Claude Code) — dispara antes de Write ou Edit.
 * Lê o input do tool via stdin (JSON), extrai o caminho do arquivo e verifica
 * se existe uma story ativa registrada em .current-story.
 * Saída para stderr (Claude Code exibe ao agente como contexto adicional).
 * Exit 0 — nunca bloqueia, só lembra.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const STORY_FILE = resolve(ROOT, ".current-story");
const ROADMAP = resolve(ROOT, "docs/epics/ROADMAP.md");

// Ler input do tool via stdin
let toolInput = {};
try {
  const raw = readFileSync("/dev/stdin", "utf8");
  toolInput = raw ? JSON.parse(raw) : {};
} catch {
  // stdin pode estar fechado em alguns contextos — continua
}

// Arquivo sendo editado
const targetFile =
  toolInput.file_path ?? toolInput.path ?? toolInput.notebook_path ?? "(desconhecido)";

// Ignorar arquivos que nunca precisam de story (docs, configs, specs, scripts)
const IGNORE_PATTERNS = [
  /specs\//,
  /docs\//,
  /scripts\//,
  /\.claude\//,
  /\.husky\//,
  /commitlint/,
  /\.md$/,
  /\.json$/,
  /\.toml$/,
  /\.yaml$/,
  /\.yml$/,
  /\.css$/,
  /\.sql$/,
  /\.gitignore/,
  /\.env/,
];

const isIgnored = IGNORE_PATTERNS.some((p) => p.test(targetFile));
if (isIgnored) process.exit(0);

// Verificar se há story ativa
const hasStory = existsSync(STORY_FILE);
const storyId = hasStory ? readFileSync(STORY_FILE, "utf8").trim() : null;

if (!hasStory || !storyId) {
  process.stderr.write(`
╔══════════════════════════════════════════════════════════════╗
║  ⚠️  PROCESSO TRIVIAIOX — NENHUMA STORY ATIVA REGISTRADA    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Você está prestes a editar: ${targetFile.slice(-40).padEnd(32)}  ║
║                                                              ║
║  ANTES de implementar, execute:                              ║
║                                                              ║
║    pnpm nova-story                                           ║
║                                                              ║
║  Ou registre manualmente:                                    ║
║    1. Leia docs/epics/ROADMAP.md — escolha story disponível ║
║    2. Marque o owner na tabela                               ║
║    3. Crie specs/E0N-S0N-nome/{spec,tasks}.md               ║
║    4. echo "E00-S01" > .current-story                        ║
║                                                              ║
║  Agentes: @pm → @sm → @dev → @qa → @devops                  ║
╚══════════════════════════════════════════════════════════════╝
`);
} else {
  process.stderr.write(`✓ Story ativa: ${storyId} | ROADMAP: docs/epics/ROADMAP.md\n`);
}

// Sempre exit 0 — avisa mas não bloqueia
process.exit(0);
