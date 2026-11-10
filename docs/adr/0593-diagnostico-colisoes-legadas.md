---
name: "docs-adr-0593-diagnostico-colisoes-legadas-md"
description: "Documento Sinérgica SO: ADR-0593 — Diagnóstico agregado de códigos legados"
alwaysApply: false
---

# ADR-0593 — Diagnóstico agregado de códigos legados

Status: proposta; gate fechado, não homologada.

A consulta 0818 soma ambiguidades dentro do Cliente autorizado, incluindo cadastros inativos e aliases, sem expor códigos ou informações de outros Clientes. É diagnóstico, não altera dados nem escolhe qual cadastro prevalece. Não prova unicidade global e, por ocorrer depois da 0332, não pode ser usada para garantir que o índice criado na 0332 será aplicável.

Antes da 0332, um administrador de banco deve executar em ambiente seguro e somente leitura a consulta abaixo. O resultado é apenas um agregado global; não identifica Clientes ou códigos. Mesmo resultado zero não substitui backup, análise de concorrência e revisão adversarial da migration. Se retornar valor maior que zero, não aplicar 0332 até definir a resolução das ambiguidades preservando histórico.

```sql
select count(*) as codigos_alias_repetidos
from (
  select upper(btrim(codigo))
  from pcm.sso_codigo_aliases
  group by upper(btrim(codigo))
  having count(*) > 1
) repetidos;
```

RPC e gate permanecem fechados. Diagnóstico posterior não substitui o preflight anterior; a consulta deve ser executada apenas quando a tabela já existir e antes de tentar 0332. Não executada nesta etapa.
