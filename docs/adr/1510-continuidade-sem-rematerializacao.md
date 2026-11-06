# ADR-1510 — Continuidade entre revisões sem rematerialização

## Contexto

Uma ocorrência criada na versão 1 pode receber selo de continuidade para a versão 2. A aprovação não obriga executar novamente o gerador na versão 2. O universo da revisão seguinte incluía a ocorrência original e usos efetivamente registrados, mas não o selo aprovado sem uso; logo uma revisão da versão 2 podia ignorar a obrigação ainda existente.

## Decisão

Para decidir, listar, avaliar e selar impactos de calendário e Visita, reconhecer também selos vinculados à versão anterior aprovada, com mesmo Plano e vigência. Usar `exists` para evitar linhas duplicadas quando também houver uso, e manter a identidade e fotografia da ocorrência original. Proteger as leituras de selos pelo mesmo protocolo de concorrência das fontes de impacto. Nenhuma OS, ocorrência ou data é alterada.

## Limites

Isto não resolve alteração de data ou regra, nem prova integral de fontes PMOC/legado. A guarda 1045 e todos os gates continuam como antes. Validar três versões com e sem rematerialização, decisões, retiradas, repetição, rollback e concorrência antes de homologar; sem deploy ou Auvo.
