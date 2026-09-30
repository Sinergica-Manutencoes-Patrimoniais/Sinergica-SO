#!/usr/bin/env node
// Compacta docs/epics/ROADMAP.md: copia o original verbatim para o histórico e gera
// uma versão enxuta (só stories em aberto, uma linha curta por story).
// Uso: node scripts/roadmap-compactar.mjs [--dry]
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const ROADMAP = 'docs/epics/ROADMAP.md'
const HISTORICO = 'docs/epics/historico/ROADMAP-ate-2026-09.md'
const dry = process.argv.includes('--dry')

const strip = (s) => s.replace(/\*\*|`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim()
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const cell = (s) => s.replace(/\|/g, '/')

const src = readFileSync(ROADMAP, 'utf8')
if (src.includes('gerado por roadmap-compactar')) {
  console.error('ROADMAP já compactado; nada a fazer.')
  process.exit(1)
}

const epicos = new Map() // id -> nome da seção
const linhas = src.split('\n')
const stories = [] // { epico, id, titulo, spec, status, owner, ac, done }
let epicoAtual = ''
const epicosTabela = []
let dentroEpicos = false

for (const l of linhas) {
  if (/^## Épicos/.test(l)) dentroEpicos = true
  else if (/^## /.test(l)) dentroEpicos = false
  const h = l.match(/^### (E\d+) — (.*)/)
  if (h) {
    epicoAtual = h[1]
    epicos.set(h[1], h[2])
  }
  if (dentroEpicos && /^\| E\d+ \|/.test(l)) epicosTabela.push(l.split(' | ').map((s) => s.replace(/^\||\|$/g, '').trim()))
  if (!/^\| E\d+-S\d+\w* /.test(l)) continue
  // descrição pode conter " | ": lê pelas pontas (id | desc... | spec | status | owner | ac)
  const p = l.replace(/^\||\|\s*$/g, '').split(' | ').map((s) => s.trim())
  const [id] = p
  const [ac, owner, status, spec] = [p.at(-1), p.at(-2), p.at(-3), p.at(-4)]
  const desc = p.slice(1, -4).join(' / ')
  const bold = desc.match(/\*\*(.+?)\*\*/)
  const titulo = strip(bold ? bold[1] : desc)
  const link = spec.match(/\[[^\]]*\]\(([^)]+)\)/)
  const done =
    /^(Implementad|Feito|Verificad|Conclu)/i.test(strip(status)) &&
    !/parcial|não implementad|bloquead|pendente/i.test(strip(status).slice(0, 120)) &&
    ac.includes('✅')
  stories.push({ epico: epicoAtual, id, titulo, spec: link ? link[1] : '—', status: strip(status), owner: strip(owner), ac, done })
}

const seq = (id) => Number(id.match(/S(\d+)/)[1])
let out = `---
name: roadmap-epicos
description: Painel de épicos e stories em aberto do Sinérgica SO (compacto). Histórico completo em docs/epics/historico/.
alwaysApply: false
---

# Roadmap — stories em aberto

> Gerado por roadmap-compactar (2026-09). **Não leia inteiro:** \`grep -n "E0N-S0N" docs/epics/ROADMAP.md\` e leia só a linha da story.
> Escopo e AC vivem no \`spec.md\` da story, nunca aqui (linha ≤ 200 caracteres).
> Stories concluídas e detalhes históricos: \`${HISTORICO}\` (cópia verbatim do ROADMAP anterior).
> Sessões paralelas: marque o **owner** antes de codar. Uma story, um owner por vez.

## Épicos

| ID | Módulo / Contexto | Status | Owner atual |
|----|-------------------|--------|-------------|
${epicosTabela.map((c) => `| ${c.slice(0, 4).map((x, i) => cell(cut(strip(x), i === 2 ? 110 : 60))).join(' | ')} |`).join('\n')}

## Stories em aberto por épico
`
for (const [ep, nome] of epicos) {
  const todas = stories.filter((s) => s.epico === ep)
  const abertas = todas.filter((s) => !s.done)
  const ultimo = todas.length ? todas.reduce((a, b) => (seq(b.id) > seq(a.id) ? b : a)).id : `${ep}-S00`
  out += `\n### ${ep} — ${nome}\n`
  out += `_${todas.length - abertas.length} concluídas no histórico · maior ID usado: ${ultimo}_\n`
  if (!abertas.length) continue
  out += '\n| ID | Título | Owner | Status | Spec |\n|----|--------|-------|--------|------|\n'
  for (const s of abertas) {
    const spec = s.spec === '—' ? '—' : `[spec](${s.spec})`
    out += `| ${s.id} | ${cell(cut(s.titulo, 90))} | ${cell(cut(s.owner || '—', 24))} | ${cell(cut(s.status, 40))} | ${spec} |\n`
  }
}
out += `
## Como abrir uma nova story

1. Pegue o próximo ID livre do épico (maior ID usado acima + 1) e adicione a linha nesta tabela com **owner**.
2. Rode \`node scripts/nova-story.mjs\` ou crie \`specs/E0N-S0N-<nome>/\` pelo fluxo Spec Kit (\`speckit-specify\`).
3. Ao concluir, remova a linha daqui (a story fica no git e no \`spec.md\`).
`

const antes = Buffer.byteLength(src)
const depois = Buffer.byteLength(out)
console.log(`stories: ${stories.length} · concluídas: ${stories.filter((s) => s.done).length} · abertas: ${stories.filter((s) => !s.done).length}`)
console.log(`bytes: ${antes} -> ${depois}`)
if (dry) {
  writeFileSync('/dev/stdout', '')
  process.exit(0)
}
mkdirSync('docs/epics/historico', { recursive: true })
if (existsSync(HISTORICO)) {
  console.error(`${HISTORICO} já existe; abortando para não sobrescrever.`)
  process.exit(1)
}
copyFileSync(ROADMAP, HISTORICO)
writeFileSync(ROADMAP, out)
