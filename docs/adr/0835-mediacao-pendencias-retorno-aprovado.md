# ADR-0835 — Mediação fechada da preparação de Pendências

## Contexto

A interface de preparação de Pendências chama uma função privada, sem ACL para `authenticated`. O núcleo 0584 verifica Cliente, decisão e condição, mas sua exposição exige uma fronteira própria. A integração de origens Grupo/Visita e a integridade de todos os escritores ainda não estão homologadas.

## Decisão

Preparar um wrapper com gate próprio inicialmente desligado, `READ COMMITTED`, trava compartilhada do protocolo de autorização até commit e nova checagem da capacidade `execucao.validar` por Cliente. Delegar ao núcleo existente, sem alterar sua ACL, seus gates ou transações. Conceder ao usuário autenticado somente execução do wrapper; gate permanece fechado. A interface aponta para o wrapper, ainda atrás das flags existentes.

## Limites

Esta mediação não prova serialização de origem, integridade das respostas perante escritores privilegiados, nem cobertura ou recepção Auvo. Não abre os gates internos, não elimina guarda Grupo/Visita e não homologa a funcionalidade. Antes de ativar, provar protocolos de origem e autorização em concorrência, integração S168 completa, consultas utilizadas pela tela e revisão adversarial. Revogação de token externo é responsabilidade distinta.
