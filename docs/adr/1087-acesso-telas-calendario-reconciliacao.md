# ADR-1087 — Acesso às novas telas de calendário e reconciliação

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar concessão de execução ao papel autenticado para as funções usadas pelas telas experimentais de mudança de dia, contexto de reconciliação de uma OS e observação/histórico local de OS. Cada função mantém os gates fechados e valida sessão, capacidades e Cliente; não se concede acesso direto às tabelas, service role ou integração externa.

## Limites

Concessão não é liberação dos gates, aprovação da funcionalidade ou deploy. Validar segurança dos quatro caminhos, limites de payload, concorrência com revogação e transferência, FORCE RLS, dados legados e revisão adversarial antes de ativar. Mudança de dia ainda não trata feriados e ocorrências preparadas; observação de OS não prova resultado remoto.
