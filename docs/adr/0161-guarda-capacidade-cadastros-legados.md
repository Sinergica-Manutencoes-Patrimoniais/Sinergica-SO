# ADR-0161 — Guarda opcional para escritores de cadastro legados

## Contexto

Capacidades de S170 já são consumidas por comandos novos, mas CRUD legado de Área, Local, Sistema e Equipamento pode escrever diretamente. A ativação abrupta quebraria operações e integração Auvo sem migração de concessões ou inventário de escritores.

## Decisão

Preparar guardas por tabela, aditivas e desligadas por padrão, verificando `cadastro.gerir` atual no Cliente antigo e novo quando houver mudança. O Cliente de Local é derivado de sua Área. Com gate ligado, falta de sessão ou escopo é recusada também em service role, sem exceção implícita; com gate desligado a operação legada não se altera. Não gerar concessões automáticas ou inferir ação crítica de escrita PCM.

## Limites

Não ativar até inventariar e adequar todos os escritores humanos e integrações, designar uma via de serviço segura, conferir concessões, efeitos de cascatas/triggers e autorizações durante concorrência. Não cobre todas as tabelas ou ações críticas de S170, nem confirma isolamento por si só. Não aplicar ou declarar compatibilidade antes dos testes e revisão adversarial.
