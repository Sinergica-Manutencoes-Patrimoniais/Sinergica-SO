# ADR-0136 — Cronogramas no staging de levantamentos

**Status:** proposta, não aplicada nem homologada.

## Decisão

Cronogramas novos devem usar `pcm.sso_levantamentos` e `pcm.sso_levantamento_linhas`, com origem `planilha`, chave em namespace exclusivo e linhas de tipo `cronograma`. A matriz fica preservada em `conteudo`, sem inferir ativos ou gravar Plano/Rotina. Autorização usa `plano.gerir`; comando de recepção é privado e protegido por gate desligado. Não usar o comando genérico de recepção de cadastros, que aceita apenas os tipos de estrutura técnica.

Os comandos da migration 0347 são revogados e os dados antigos são preservados intactos. Não transportar automaticamente seus lotes: podem existir revisões, colisões de IDs e fontes, comandos idempotentes e atores que precisam de diagnóstico e reconciliação. A consulta de cronogramas antiga também fica revogada para não apresentar visão incompleta como canônica.

## Limites e implantação

Esta migration não liga a interface nem transforma lotes da 0347. Faltam prévia, correção e aprovação especializadas, nova consulta e adapter, migração auditada dos dados antigos, isolamento contra aprovação de cadastro, revisão de permissões, concorrência e testes. Antes de qualquer aplicação, avaliar 0347/0361 como conjunto e manter recurso desligado. Não há exclusão de dados nem execução Auvo.
