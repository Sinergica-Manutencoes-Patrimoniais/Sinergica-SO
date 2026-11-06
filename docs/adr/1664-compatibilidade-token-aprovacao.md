---
name: adr-1664-compatibilidade-token-aprovacao
description: Preserva a compatibilidade do token de aprovação com o gate fechado.
alwaysApply: false
---

# ADR-1664 — Compatibilidade do token de aprovação com gate fechado

## Contexto

A migration 1805 preserva o replay no núcleo, mas a borda 1804 insere o token mesmo com o gate desligado. Com FORCE RLS e proprietários sem privilégios adequados, isso pode impedir aprovação e repetição pela borda nova antes do rollout.

## Decisão

Sem alterar a 1805, uma migration aditiva altera a borda 1804: apenas aprovação nova com gate habilitado insere e remove token. O gate é lido sob trava compartilhada até o fim da transação, para impedir mudança entre essa decisão e a verificação no núcleo. Replay não cria token e conserva as validações e gates preexistentes.

A leitura usa função privada SECURITY DEFINER. Uma verificação de instalação exige donos capazes de atravessar FORCE RLS e privilégios efetivos mínimos para tabelas e funções internas; interrompe a migration se não forem comprovados. Nenhum papel exposto recebe BYPASSRLS ou acesso às tabelas privadas. Revogação de permissões e guardas anteriores permanecem aplicáveis.

## Limites de implantação

A 1805 pode ser incompatível antes de esta migration ser aplicada. Exige-se integração atômica com 1805 ou janela controlada e avaliação prévia do ambiente, proprietários e tokens preexistentes; não se apaga histórico ou token existente automaticamente. A validação de instalação não garante mudanças posteriores de privilégios. A ativação do gate continua exigindo rollout dos clientes e ensaios de autorização, rollback, concorrência e replays dos dois protocolos. Sem essas provas não há autorização de produção.
