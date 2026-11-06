# ADR-0764 — Mediação de finalização validada

**Status:** preparada, sem homologação. **Data:** 2026-10-30.

## Contexto

As funções preparadas de prévia, finalização v2 e reconciliação não têm concessão direta a usuários. A interface precisa de fronteira restrita que não exponha funções internas nem habilite automaticamente transições.

## Decisão

Três mediadores `SECURITY DEFINER` com `search_path` vazio recebem somente argumentos tipados e delegam às funções existentes. Antes da delegação exigem gate próprio, inicialmente fechado, sessão e capacidade atual `execucao.validar` no Cliente. As funções delegadas mantêm seus próprios gates, autorização, vínculo de Cliente, bloqueio transacional, revisão e idempotência. EXECUTE é concedido somente aos mediadores para `authenticated`; tabelas e funções internas continuam sem concessão. Repetição legada continua exclusivamente consulta e ausência não habilita nova escrita.

## Limites

Não abre gates, implanta funções nem chama Auvo. Exige testes positivos/negativos, concorrência, revisão adversarial e homologação antes de qualquer ativação. Revogação de concessão deve impedir nova operação mesmo que o estado da tela esteja antigo.
