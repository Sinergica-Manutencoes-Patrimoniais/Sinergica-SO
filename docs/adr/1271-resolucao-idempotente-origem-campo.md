# ADR-1271 — Resolução idempotente da origem capturada

Status: proposta local; não aplicada nem homologada.

Após captura autenticada, o serviço pode solicitar resolução do envelope existente por Cliente externo e tarefa. A nova fronteira serializa pelo envelope, compara o resultado atual com a última resolução e só registra nova resolução quando ela muda. Cliente desconhecido, OS inexistente ou Cliente divergente continuam estados de triagem; nenhuma OS ou Chamado é criado por esta operação.

A resolução reutiliza a função existente e o gate de inbox, com acesso restrito ao papel de serviço. Deve permanecer desativada até validar conflitos com triagem humana, fontes legadas, revogação, RLS/FORCE, concorrência webhook/polling, índices, retenção e revisão adversarial. A existência de OS não comprova execução ou origem de conteúdo. A criação transacional de OS e Chamado continua etapa independente e obrigatória.
