# ADR-1508 — Mediação de aprovação de revisão

## Contexto

A função preparada de revisão é privada desde a migration 0342; o adapter a chamava diretamente, portanto uma chamada autenticada não tem execução. A guarda independente 1045 bloqueia toda aprovação de revisão até prova integral de impactos e fuso.

## Decisão

Adicionar função mediadora com gate próprio desligado por padrão, identidade da sessão explícita, autorização por Cliente atual, bloqueio do Plano e protocolo de concorrência de impactos. A mediação chama o núcleo privado sem modificar a assinatura, ACL ou comportamento deste. O adapter envia ator e Cliente. Replay usa o mesmo núcleo e revalida autorização; nenhuma flag é ativada.

## Limites

A guarda 1045 permanece intacta. O caminho continua incapaz de aprovar até decisão arquitetural e prova integral; a UI permanece bloqueada. Antes de habilitar ou homologar: conferir protocolo dos escritores, autorização/revogação concorrente, isolamentos, retry, histórico e fontes, e revisão adversarial. Nenhuma OS ou tarefa Auvo é gerada.
