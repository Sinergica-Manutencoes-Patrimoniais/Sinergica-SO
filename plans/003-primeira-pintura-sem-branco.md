# 003 — Primeira pintura: shell inline e fonte sem bloqueio

- **Status**: DONE
- **Commit**: cc104969
- **Severity**: HIGH
- **Category**: Percepção
- **Estimated scope**: 1 arquivo (`apps/web/index.html`), ~40 linhas

## Problem

O HTML publicado entrega um `#root` vazio. Até o JS baixar e parsear, a tela é branca:

```html
<!-- apps/web/index.html — atual -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:...&family=Saira:...&display=swap" rel="stylesheet" />
  <script type="module" crossorigin src="/assets/index-....js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-....css">
</head>
<body>
  <div id="root"></div>
</body>
```

Dois problemas somados:

1. **Nada é pintado antes do JS.** Com o bundle atual de 1,49 MB gzip, são segundos de branco.
2. **O CSS do Google Fonts é render-blocking** e só é descoberto depois do HTML: o `preconnect`
   ajuda no socket, mas a folha ainda é uma viagem extra na frente do primeiro pixel.

## Target

Um shell estático inline, pintado pelo HTML, com a cor de fundo do tema e a marca — o mesmo
"esqueleto" que o app vai substituir. Sem framework, sem JS, inline no `<head>`/`<body>` para não
custar nenhuma requisição.

```html
<!-- target -->
<style>
  /* Shell de primeira pintura. Removido pelo React no primeiro render (o #root recebe o app e
     o #shell sai do DOM). Cores literais de propósito: os tokens vivem no CSS do bundle, que
     ainda não chegou neste instante. */
  #shell { position: fixed; inset: 0; display: grid; place-items: center;
           background: #10131d; }
  #shell img { width: 120px; opacity: .9; }
  @media (prefers-color-scheme: light) { #shell { background: #ffffff; } }
</style>
...
<body>
  <div id="shell"><img src="/logos/favicon.png" alt="" /></div>
  <div id="root"></div>
</body>
```

E a fonte deixa de bloquear:

```html
<link rel="preload" as="style"
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Saira:wght@400;500;600;700;800&display=swap" />
<link rel="stylesheet" media="print" onload="this.media='all'"
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Saira:wght@400;500;600;700;800&display=swap" />
<noscript>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Saira:wght@400;500;600;700;800&display=swap" />
</noscript>
```

`display=swap` já está na URL, então o texto aparece na fonte de sistema e troca — não fica
invisível.

## Repo conventions to follow

- O favicon já existe em `/logos/favicon.png` (referenciado em `index.html`), então o shell não
  adiciona asset novo.
- A cor de fundo do tema escuro é `--color-paper: #10131d` (`apps/web/src/index.css`, bloco
  `html[data-theme="dark"]`). Use esse valor literal no shell.
- O projeto NÃO usa biblioteca de animação (ADR-0018) — o shell não anima, só existe e some.

## Steps

1. Em `apps/web/index.html`, adicionar o `<style>` do shell dentro do `<head>`.
2. Trocar o `<link rel="stylesheet">` do Google Fonts pelo trio preload/media-swap/noscript do
   Target.
3. Adicionar `<div id="shell">` antes de `<div id="root">` no `<body>`.
4. Em `apps/web/src/main.tsx` (o entry que faz `createRoot`), remover o shell logo após o
   primeiro render: `document.getElementById("shell")?.remove();` depois do `root.render(...)`.

## Boundaries

- NÃO adicionar dependência, framework de splash, nem animação.
- NÃO mexer em `vite.config.ts` (é o plano 001).
- NÃO inlinar CSS do app no HTML — só o bloco mínimo do shell.
- NÃO usar `onload` inline se houver CSP que proíba — se existir `Content-Security-Policy` com
  `script-src` restritivo no `netlify.toml` ou em headers, PARE e relate.

## Verification

- **Mecânica**:
  - `pnpm --filter @sinergica/web build` limpo.
  - `grep -c 'id="shell"' apps/web/dist/index.html` retorna 1.
  - `pnpm -w test` verde.
- **Feel check**: abrir o app com throttling de rede "Fast 3G" no DevTools. O fundo e a marca
  devem aparecer quase imediatamente, e não pode haver flash de branco entre o shell sumir e o
  app aparecer (os dois usam a mesma cor de fundo). Conferir nos dois temas.
