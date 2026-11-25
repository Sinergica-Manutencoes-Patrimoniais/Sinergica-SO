---
name: planos-fluidez-e00-s29
description: Índice dos planos de fluidez e sensação de carregamento do apps/web (E00-S29), com ordem de execução, dependências e as medições de referência.
alwaysApply: false
---

# Planos — fluidez e sensação de carregamento (E00-S29)

Owner E00-S29: Codex — continuação do PR #117 (rebase e CI, 25/11/2026).

Auditoria de 24/11/2026 sobre o `apps/web`, a partir do bundle publicado em
`https://so-sinergica.netlify.app`. O problema relatado ("muita impressão de loading") tem causa
dominante **antes** de qualquer esqueleto: 1,49 MB de JS gzip num único chunk, com tela branca até
parsear.

Os tokens de movimento, o comportamento do modal e o primitivo `Skeleton` já estão no nível certo
(ADR-0018) — nenhum plano mexe neles.

## Ordem de execução

| # | Plano | Sev | Depende de | Status |
|---|---|---|---|---|
| 001 | [Quebrar o bundle único em chunks por módulo](001-code-splitting-por-modulo.md) | HIGH | — | **DONE** |
| 002 | [Permissões no TanStack Query e fim do waterfall](002-permissoes-sem-waterfall.md) | HIGH | — | **DONE** |
| 003 | [Primeira pintura: shell inline e fonte sem bloqueio](003-primeira-pintura-sem-branco.md) | HIGH | — | **DONE** |
| 004 | [Moldura persistente: esqueleto na região](004-moldura-persistente.md) | HIGH | 002 | **DONE** |
| 005 | [Filtro e busca não derrubam a lista](005-filtro-sem-piscar.md) | MEDIUM | — | **DONE** |
| 006 | [Polimento: esqueleto com forma e entrada do conteúdo](006-polimento-esqueleto-e-entrada.md) | LOW | 004 | **DONE** |

**Dependências reais:** 004 depende de 002 (sem o cache de permissão, tirar o esqueleto de
permissão deixaria a moldura esperando de graça). 006 depende de 004 (a utilitária de entrada se
aplica ao bloco que 004 isola). 001, 002, 003 e 005 são independentes entre si.

## Medições de referência (24/11/2026, antes)

```
JS de entrada: 5,8 MB cru / 1,49 MB gzip — chunk único
CSS:           16 KB
HTML:          #root vazio, sem shell
useCargaVisivel: usado em 1 componente (DataTable)
placeholderData: 6 arquivos
return de página inteira em isPending: 22 ocorrências
```

Meta do 001: chunk de entrada ≤ 500 KB gzip.

## Por que 005 parou onde parou

A varredura achou 153 consultas com filtro na chave e sem `placeholderData`. Aplicar em todas de
uma vez seria temerário, e boa parte delas **não deve** receber: as telas de capacidade/agenda
(`capacidade-agenda/Workspace.tsx`, `OcorrenciasSemOs.tsx`, `FilaPreventivaWorkspace.tsx`) usam
`gcTime: 0` junto com reconferência de sessão a cada página — manter dado anterior na tela
contraria uma decisão de segurança deliberada daquelas telas, não um descuido.

Foram feitas as que o filtro é navegação pura e não há essa restrição: a Agenda do Técnico (setas
de semana), o Monitor de exceções (seletor de Cliente) e as seis consultas do painel Comercial
(seletor de período). O que sobra são consultas de detalhe — onde trocar de registro **deve**
limpar a tela, porque mostrar o anterior seria mentira — e as de `gcTime: 0` acima.

## Remedição após rebase (25/11/2026, PR #117)

Base: `main` em `305bee5e` (inclui #120 e #123). Build Vite 7.3.7 com Node 22.23.2,
pnpm 9.0.0 e as mesmas flags `VITE_SSO_*` de `[build.environment]` do `netlify.toml`
nos dois builds. Supabase sintético: `http://127.0.0.1:54321`, chave pública de teste.
Sem arquivo `.env` local. Gzip calculado com `node:zlib.gzipSync`, nível padrão, em bytes;
KB decimal (1 KB = 1.000 bytes). O custo inicial soma o script de entrada e todos os
`modulepreload` do HTML, sem CSS, fontes ou chunks carregados sob demanda.

| Medida | main atual | PR rebaseado |
|---|---:|---:|
| JS da entrada (gzip) | 1.506.692 bytes (1.506,69 KB) | 200.635 bytes (200,64 KB) |
| Entrada + modulepreload (gzip) | 1.506.692 bytes (1.506,69 KB) | 283.539 bytes (283,54 KB) |
| Chunks JS emitidos | 4 | 164 |

Redução de **81,18%** no JS inicial. Os números de 24/11 acima ficam como registro histórico;
esta comparação substitui a antiga de 1.490K para 273K no PR.

Conferido em `dist/.vite/manifest.json` (`vite build --manifest`): Roteiros de Entrevista,
Indicadores da Meta, Receita por Campanha, Atendimento (Configuração/Inbox, incluindo Instagram)
e Ordens de Serviço são entradas dinâmicas fora da árvore estática inicial. O workspace de
reconciliação permanece sob Estrutura do Cliente, alcançado pela página lazy Visão do Cliente.
A conversão do Monitor de Exceções preserva `DataTable.legenda` e seu caption acessível.
`netlify.toml`, `.env.example` e ROADMAP permanecem iguais à base atual; nenhuma migration criada.
