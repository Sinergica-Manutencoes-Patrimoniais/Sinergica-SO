---
name: planos-fluidez-e00-s29
description: Índice dos planos de fluidez e sensação de carregamento do apps/web (E00-S29), com ordem de execução, dependências e as medições de referência.
alwaysApply: false
---

# Planos — fluidez e sensação de carregamento (E00-S29)

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
| 004 | [Moldura persistente: esqueleto na região](004-moldura-persistente.md) | HIGH | 002 | **PARCIAL** — Kanban feito; 21 telas restantes |
| 005 | [Filtro e busca não derrubam a lista](005-filtro-sem-piscar.md) | MEDIUM | — | **PARCIAL** — Agenda e Monitor feitos |
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

## Por que 005 ficou parcial

A varredura achou 153 consultas com filtro na chave e sem `placeholderData`. Aplicar em todas de
uma vez seria temerário, e boa parte delas **não deve** receber: as telas de capacidade/agenda
(`capacidade-agenda/Workspace.tsx`, `OcorrenciasSemOs.tsx`, `FilaPreventivaWorkspace.tsx`) usam
`gcTime: 0` junto com reconferência de sessão a cada página — manter dado anterior na tela
contraria uma decisão de segurança deliberada daquelas telas, não um descuido.

Foram feitas as duas em que o filtro é navegação pura e não há essa restrição: a Agenda do Técnico
(setas de semana) e o Monitor de exceções (seletor de Cliente). O resto precisa ser avaliado caso
a caso, por domínio.
