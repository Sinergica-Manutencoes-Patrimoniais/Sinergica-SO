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
| 003 | [Primeira pintura: shell inline e fonte sem bloqueio](003-primeira-pintura-sem-branco.md) | HIGH | — | TODO |
| 004 | [Moldura persistente: esqueleto na região](004-moldura-persistente.md) | HIGH | 002 | TODO |
| 005 | [Filtro e busca não derrubam a lista](005-filtro-sem-piscar.md) | MEDIUM | — | TODO |
| 006 | [Polimento: esqueleto com forma e entrada do conteúdo](006-polimento-esqueleto-e-entrada.md) | LOW | 004 | TODO |

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
