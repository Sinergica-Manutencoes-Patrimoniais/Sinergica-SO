# ADR-0837 — Preparar travas das fontes de upload

Status: experimental e desconectado; não altera policies nem autoriza rollout.

## Contexto

O dispatcher da 1021 serializa fontes de permissão, mas ensaio com duas
sessões mostrou que gates e entidades usados por cinco buckets ainda podem
mudar antes do commit do upload. A despesa já possui travas próprias.

## Decisão

Preparar função privada VOLATILE que, sob READ COMMITTED e após adquirir a
trava compartilhada de autorização, toma `FOR SHARE NOWAIT` dos gates e
registros necessários ao bucket selecionado antes de delegar à 1021. Em
contenção, caminho inválido ou referência ausente, negar; não aguardar com
snapshot obsoleto. A função permanece inacessível aos papéis de aplicação e
desconectada de policies. Nenhum gate ou ACL de helper é aberto.

## Limites

A estratégia depende de SQL privilegiado no schema e precisa de testes das
duas ordens, deleções, mutação simultânea e caminhos legítimos. ACLs de
funções podem ser alteradas por GRANT/REVOKE fora do protocolo de autorização;
isso ainda não está serializado. A ordem de travas pode conflitar com outros
comandos; avaliar contenção, regressões, tráfego Storage real e revisão
adversarial antes de qualquer política conectada. Não usar isoladamente como
garantia completa nem liberar upload direto.
