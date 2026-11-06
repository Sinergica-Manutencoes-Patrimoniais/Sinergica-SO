# ADR-1225 — Recibo de decisão de proposta no Portal

## Decisão

Preparar consulta autenticada do recibo de uma decisão já registrada, por requestId e conteúdo completo, sem executar novamente aceite ou recusa. Exige mesmo ator e vínculo atual do Cliente, OS e proposta; devolve somente o recibo previamente gravado.

Uma consulta sem recibo não comprova falha de decisão em andamento. Alteração de vínculo, revogação ou indisponibilidade pode impedir recuperação; a tentativa permanece guardada. O recibo não cria cobrança ou comunica terceiros.

## Gates

Manter flag e gates fechados até testes de RLS/FORCE, revogação, transferência, concorrência com commit, alteração de versão, privacidade e revisão adversarial.
