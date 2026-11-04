# ADR-1228 — Informação de disponibilidade mediada no Portal

## Decisão

Preparar entrada autenticada da informação de disponibilidade vinculada explicitamente ao ator, Cliente, OS e lista. A entrada reutiliza o gate e a autorização transacional do ADR-1220, confere a titularidade da lista sob trava e delega revisão, auditoria e repetição ao comando existente. A trava de request é adquirida antes das demais, como no núcleo existente. Não registra disponibilidade em nome de outro contato e não envia tarefas externas.

## Limites e gates

Manter a flag desligada até testar autorização e revogação concorrentes, alteração de lista e visibilidade, ordem global de travas, RLS/FORCE, repetição após retirada ou transferência, resposta perdida e revisão adversarial. A entrada legada não é revogada nesta migration e deve ser inventariada e protegida em rollout coordenado. Recusa de repetição após mudança de visibilidade não comprova falha da tentativa anterior.
