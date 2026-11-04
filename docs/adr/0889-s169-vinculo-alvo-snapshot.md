# ADR-0889 — Vínculo do alvo na fotografia exportável

Data: 2026-10-30 · Status: preparação; gates fechados, não homologado.

## Contexto

A leitura 1073 confere tipo, ID e nome do alvo no objeto `alvo`, mas ainda aceita fotografia em que o ID do objeto difere da chave registrada na própria Rotina, ou em que existem vários vínculos funcionais. Um nome e ID válidos não demonstram que são o alvo aprovado.

## Decisão

Adicionar entrada mediada que primeiro reutiliza a leitura 1073 e suas travas, depois exige que cada Rotina de toda a fotografia tenha exatamente um dos vínculos `sistema_id`, `equipamento_id` ou `grupo_id`, que corresponda ao tipo e ao ID do objeto `alvo`. Não consultar cadastro vivo para substituir o nome histórico. Falha em qualquer página invalida a fotografia inteira; não preencher automaticamente dados legados incompletos.

A entrada 1073 passa a núcleo privado e o adapter deve usar a nova entrada em rollout coordenado, com gate ainda fechado. Conferir testes de Cliente, ACL e corridas, além de revisão adversarial antes da ativação. Não altera snapshots, cadastros ou códigos; nenhuma OS ou tarefa nasce da leitura.

## Compatibilidade e retorno

Esta sequência depende de 1073 e requer atualizar interface/adapter e banco conjuntamente; devolver chamada para 1073 sem restaurar ACL faria as leituras falharem fechadas. Para retorno, manter o gate fechado e reverter o consumidor antes de restaurar ACL anterior, sob governança de implantação. Snapshots históricos inválidos ficam indisponíveis até saneamento auditado próprio.
