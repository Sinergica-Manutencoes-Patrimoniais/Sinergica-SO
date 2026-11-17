#!/usr/bin/env node
// E01-S190 task 1/15 — inventário estrutural de "ações alcançáveis": toda entrada de navegação
// (label + identificador de view/aba) extraída do(s) arquivo(s) de menu. Roda ANTES e DEPOIS da
// reorganização; a saída normalizada (ordenada, uma entrada por linha) é comparável por `diff` —
// é a prova de AC-7 ("nenhuma ação alcançável sumiu sem decisão registrada").
//
// Não simula permissão por perfil ao vivo (exigiria sessão Supabase real) — compara o CATÁLOGO
// estrutural de ações, que é a parte que a reorganização de menu pode derrubar por acidente.
//
// Uso:
//   node scripts/inventariar-navegacao.mjs                                   # lê HomePage.tsx (pré-refactor)
//   node scripts/inventariar-navegacao.mjs apps/web/src/app/navegacao-sso.ts  # lê o módulo extraído (pós-refactor)
import { readFileSync } from "node:fs";

const ARQUIVO = process.argv[2] ?? "apps/web/src/app/HomePage.tsx";
const conteudo = readFileSync(ARQUIVO, "utf8");

// Cada objeto de entrada de nav tem `label:` e, na mesma linha ou perto, `view:`/`id:`/
// `atalhoConfigGrupos:`. Convenção do arquivo: um objeto por linha (`{ label: "X", icon: Y, view: "z" }`).
const RX_ENTRADA = /\{\s*label:\s*"([^"]+)"[^}]*\}/g;
const RX_VIEW = /\bview:\s*"([^"]+)"/;
const RX_ID = /\bid:\s*"([^"]+)"/;
const RX_ATALHO = /atalhoConfigGrupos:\s*true/;
// CONFIG_NAV usa `{ id: "x", label: "Y", icon: Z }` — label pode vir depois de id.
const RX_ENTRADA_ID_PRIMEIRO = /\{\s*id:\s*"([^"]+)"[^}]*label:\s*"([^"]+)"[^}]*\}/g;

const linhas = new Set();

let m = RX_ENTRADA.exec(conteudo);
while (m) {
  const bloco = m[0];
  const label = m[1];
  const view = RX_VIEW.exec(bloco)?.[1];
  const atalho = RX_ATALHO.test(bloco);
  const chave = view ? `view:${view}` : atalho ? "atalho:config-grupos" : `label-only:${label}`;
  linhas.add(`${chave}\t${label}`);
  m = RX_ENTRADA.exec(conteudo);
}

m = RX_ENTRADA_ID_PRIMEIRO.exec(conteudo);
while (m) {
  const [, id, label] = m;
  linhas.add(`id:${id}\t${label}`);
  m = RX_ENTRADA_ID_PRIMEIRO.exec(conteudo);
}

for (const linha of [...linhas].sort()) console.log(linha);
