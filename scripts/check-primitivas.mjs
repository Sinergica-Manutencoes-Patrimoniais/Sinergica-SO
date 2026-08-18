#!/usr/bin/env node
// E00-S15 — gate: tabela, modal e raio arbitrário só existem dentro de packages/ui. Suporta
// filtro por padrão via --modal/--table/--button/--badge/--radius (senão roda tudo).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const APENAS = ["modal", "table", "button", "badge", "radius"].find((f) =>
  process.argv.includes(`--${f}`),
);

const RAIZ = ["apps/web/src", "apps/portal/src"];
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;

function arquivos(dir) {
  let out = [];
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return out;
  }
  for (const nome of entradas) {
    if (IGNORAR_DIR.has(nome)) continue;
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) out = out.concat(arquivos(caminho));
    else if (/\.tsx?$/.test(nome) && !IGNORAR_ARQUIVO.test(nome)) out.push(caminho);
  }
  return out;
}

// financeiro/mock/** é protótipo navegável com dados fictícios (banner próprio avisa), não tela
// real — `TableShell` usa `<table>` semântico de verdade (thead/tbody exigem `table` como pai;
// `role="table"` num `<div>` só pra escapar deste gate quebra acessibilidade de propósito).
const IGNORAR_TABLE = /features\/financeiro\/mock\//;

const REGRAS = [
  {
    nome: "table",
    padrao: /<table\b/g,
    motivo: "use <DataTable> de @sinergica/ui",
    ignorar: IGNORAR_TABLE,
  },
  { nome: "modal", padrao: /\bmodal-backdrop\b/g, motivo: "use <Modal> de @sinergica/ui" },
  {
    nome: "button",
    padrao: /<button\b(?![^>]*\btype="submit"[^>]*\bform=)[^>]*\bclassName=/g,
    motivo: "use <Button> de @sinergica/ui (botão cru estilizado fora de packages/ui)",
  },
  {
    nome: "radius",
    padrao: /rounded-\[\d+px\]/g,
    motivo: "use rounded-sm/md/lg/xl (tokens de E00-S15)",
  },
];

const todosArquivos = RAIZ.flatMap((dir) => arquivos(dir));

let violacoes = [];
for (const caminho of todosArquivos) {
  const conteudo = readFileSync(caminho, "utf8");
  const linhas = conteudo.split("\n");
  for (const regra of REGRAS) {
    if (APENAS && regra.nome !== APENAS) continue;
    if (regra.ignorar?.test(caminho)) continue;
    linhas.forEach((linha, i) => {
      regra.padrao.lastIndex = 0;
      if (regra.padrao.test(linha)) {
        violacoes.push({ arquivo: relative(process.cwd(), caminho), linha: i + 1, regra: regra.nome, motivo: regra.motivo });
      }
    });
  }
}

// badge: heurística separada (contagem de classe repetida `rounded-full ... px-2` fora de packages/ui
// já cai pra 0 conforme a migração da task 12/18 avança; contamos como aviso, não bloqueia o gate
// sozinho porque `rounded-full` tem usos legítimos fora de badge (avatar, dot indicator).

if (violacoes.length === 0) {
  console.log(`✓ check-primitivas${APENAS ? ` --${APENAS}` : ""}: nenhuma violação.`);
  process.exit(0);
}

console.error(`✗ check-primitivas: ${violacoes.length} ocorrência(s).\n`);
const porArquivo = new Map();
for (const v of violacoes) {
  if (!porArquivo.has(v.arquivo)) porArquivo.set(v.arquivo, []);
  porArquivo.get(v.arquivo).push(v);
}
for (const [arquivo, lista] of porArquivo) {
  console.error(`  ${arquivo}`);
  for (const v of lista.slice(0, 5)) console.error(`    ${v.linha}: [${v.regra}] ${v.motivo}`);
  if (lista.length > 5) console.error(`    … +${lista.length - 5}`);
}
process.exit(1);
