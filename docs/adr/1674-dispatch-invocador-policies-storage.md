---
name: adr-1674-dispatch-invocador-policies-storage
description: Mediação invocadora dos predicados de policies de upload.
alwaysApply: false
---

# ADR-1674 — Predicados de upload sob o papel invocador

## Estado

Proposta pendente de revisão e ensaio isolado. Não abre gates, não concede os helpers privados e não autoriza deploy.

## Contexto e decisão

No ensaio de 1814 o upload de evidência de retorno continuou recusado por EXECUTE em helper privado de outro bucket, mesmo com CASE na policy. A migration 1815 substitui as referências a três helpers alheios nas seis policies revisadas por um dispatcher PL/pgSQL `SECURITY INVOKER`.

O dispatcher recebe bucket e nome. Para cada bucket reconhecido, confere sob `current_user` o EXECUTE efetivo do helper correspondente antes de chamá-lo; ausência retorna falso. Herança de papel é considerada pela verificação de privilégio do PostgreSQL. Não utiliza privilégio do owner, não concede os helpers, não expõe caminhos e não ativa gates. O dispatcher é concedido a `authenticated`, nunca a `anon` ou PUBLIC. Chamada direta só pode obter o booleano de um helper que o próprio invocador já poderia executar. Para bucket não reconhecido devolve falso.

O preflight compara as seis policies com a forma canônica esperada após 1814, incluindo roles, comando e permissividade. Divergência aborta toda a migration. A negação de um helper próprio sem EXECUTE passa de erro de permissão a falso; continua negada. Os demais predicados, policies e gates permanecem como estavam.

## Limites

Antes de habilitar ou publicar, provar em clone planejamento/execução, acesso permitido, Cliente divergente, sessão ausente, papéis herdados e concessões preexistentes, gates e concorrência. Policies externas ao recorte precisam de inventário no destino. Reversão requer migration aditiva revisada; não modificar histórico nem conceder helpers como atalho.
