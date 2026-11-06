---
name: "supabase-tests-manual-s168-gate-concorrencia-resultado-md"
description: "Documento Sinérgica SO: E01-S168 — concorrência do gate de finalização"
alwaysApply: false
---

# E01-S168 — concorrência do gate de finalização

Verificação manual no PostgreSQL descartável local, porta 55522, com migrações 0969, 0971 e 0972 aplicadas somente nessa base e fixtures sintéticas com FKs e triggers normais. Não houve acesso ao Auvo.

- Operação iniciada antes do fechamento: a finalização da OS `16895000-0000-4000-8000-000000000017` retornou `finalizado`; a atualização do gate aguardou `Lock|transactionid` até o commit da operação e então fechou o gate.
- Fechamento iniciado antes da operação: a chamada para OS `16896000-0000-4000-8000-000000000017` aguardou `Lock|transactionid` e, após o commit do fechamento, retornou `mediacao_finalizacao_bloqueada`; a OS permaneceu `em_execucao`.
- Ao final, os seis gates foram restaurados para `false`; `authenticated` mantém execução do mediador, mas não da função interna v2.
- As fixtures sintéticas persistem na base descartável; o histórico append-only não foi removido. A permissão concorrente após a última checagem e corridas em dados de snapshot não foram demonstradas por esses testes.

Essa evidência não substitui revisão adversarial nem autoriza homologação ou abertura operacional dos gates.

## Revogação após última checagem

Em uma fixture distinta `16897000`, a sessão administrativa segurou `audit.events` em `ACCESS EXCLUSIVE` e a chamada mediada aguardou `Lock|relation` na gravação posterior à última checagem de autorização. A mesma sessão revogou a concessão `execucao.validar` do ator e confirmou a transação antes de liberar a tabela. Mesmo após a revogação confirmada, a chamada concluiu com `finalizado`. A fixture e sua concessão desativada permanecem no banco descartável; os seis gates foram fechados. Nenhum grant foi alterado.

O fechamento serializado dos gates em 0972 não serializa revogações. A autorização também depende de usuário, cliente, ação, concessões diretas ou por perfil, associação e ativação de perfil e permissões de módulo; bloquear apenas a linha da concessão demonstrada não prova segurança para os demais caminhos. A correção requer estratégia que preserve uma testemunha completa da autorização durante a transação e testes para cada caminho, incluindo concorrência com concessões novas. Até lá, o gate permanece fechado.

## Protocolo 0319 com migração 0976

Aplicada apenas na base descartável: com finalização da OS `16898000-0000-4000-8000-000000000017` iniciada primeiro, revogação da concessão aguardou `Lock|advisory` até o commit da finalização. Com revogação da fixture `16899000` iniciada primeiro, chamada concorrente retornou `autorizacao_em_alteracao`; após commit da revogação, retornou `sem_acesso`, e a OS permaneceu `em_execucao`. O teste de isolamento rejeita `REPEATABLE READ`. Gates restaurados fechados; grants inalterados; fixtures persistem na base descartável.

Foram inspecionados os resolvedores e os dez triggers de 0319 nesta base, mas os caminhos de perfis, grupos, módulos e concessão concorrente ainda não foram individualmente exercitados. O protocolo depende de manter triggers alinhados com alterações futuras dos resolvedores e não resolve corridas no snapshot técnico. Homologação segue bloqueada.

Um teste posterior de duas sessões (`E01-S168_fontes_autorizacao_concorrencia.test.sql`) manteve a trava compartilhada e tentou UPDATE em cada uma das dez fontes. Todos os dez comandos receberam `55P03` pelo `lock_timeout`, comprovando que os triggers statement-level aguardam a mesma trava; os comandos não alteraram linhas e foram revertidos. Isso não equivale a testar os fluxos funcionais reais de revogação por perfil, grupo e módulo.

Inspeção de snapshot: `pcm.sso_proteger_versao_aprovada` proíbe mudar conteúdo da versão aprovada; as rotas de evidência manual e decisão de resposta obtêm `FOR UPDATE` no retorno, assim como a finalização. A role authenticated não tem escrita direta nas tabelas verificadas. Não foi feita auditoria exaustiva de todos os escritores nem prova integrada de corrida sobre evidências e respostas; não se declara snapshot integralmente protegido.
