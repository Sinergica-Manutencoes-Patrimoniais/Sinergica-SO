---
name: "docs-adr-1589-validacao-transacional-revisao-md"
description: "Documento Sinérgica SO: ADR 1589 — Validação transacional da revisão"
alwaysApply: false
---

# ADR 1589 — Validação transacional da revisão

## Contexto
A guarda 1045 bloqueia toda revisão mesmo quando as fontes SSO observadas já foram conferidas e os validadores do token foram instalados. A RPC mediada possui gate fechado por padrão e o protocolo 1700/1724 exige gates, isolamento e os validadores obrigatórios.

## Decisão
A própria guarda 1045 exige o protocolo de validadores, identidade, autorização por Cliente e token da transação antes de permitir o INSERT. Os demais triggers seguem validando decisões e fotografias de calendário, Visita, Grupo, OS, retiradas, questionários, PMOC e selos na mesma transação; qualquer erro reverte tudo. Não existe nova autorização por equivalência de datas ou alvo, nem se exige ausência global de dados Auvo. Um gate dedicado, criado desligado, impede a liberação acidental em instalações cujos gates anteriores já estavam ligados. Não são alterados os gates existentes.

## Limites
Fontes externas não são comprovadas. Relação entre Planos, coincidência de datas e alvo não estabelecem que ciclos sem reserva sejam equivalentes; as escolhas explícitas e suas guardas continuam aplicáveis aos pares classificados. A migração não autoriza deploy nem habilita os gates. Exige revisão adversarial, testes autenticados positivos e negativos, concorrência, integração completa e homologação. Reversão: restaurar o corpo incondicional da função 1045, sem alterar dados ou triggers.
