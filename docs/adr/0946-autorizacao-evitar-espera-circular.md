# ADR-0946 — Falha explícita quando autorização está em alteração

Status: preparação local; não homologada.

## Problema

O trigger 0319 aguarda trava global de autorização. Um escritor que já detenha trava de linha pode aguardar essa trava enquanto outra transação que a detém aguarda a mesma linha. A ordem de travas não é uniforme em todos os fluxos administrativos.

## Decisão

Preparar substituição aditiva da função do trigger para tentar a trava exclusiva sem espera e retornar `55P03` quando outra transação a detiver. Comandos devem abortar a transação e informar operação concorrente, preservando requestId e sem retentativa cega de efeitos. Permanece obrigatória a mesma chave de trava para todos os escritores e leitores mediados. Não alterar permissões, concessões, dados ou triggers existentes.

## Limites e validação

Isto elimina somente espera na aquisição dessa trava; não prova ausência de outros deadlocks nem que todas as fontes de autorização estão cobertas. Testar duas sessões nas duas ordens, transações que já tenham travas de linha, reentrância, rollback, todos os escritores, UX de erro, RLS e estabilidade sob carga. Revisar adversarialmente e planejar rollout antes de aplicar. Não ativar comandos críticos com base apenas nesta proposta.
