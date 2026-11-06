# ADR-1064 — Rascunho rastreável de Plano legado

**Status:** preparação privada, não homologada. Complementa E01-S186 e a fundação E01-S165.

Comando transacional recebe fotografia integral do Plano preventivo e escolhas explícitas de modo, recorrência e tolerâncias. Sob trava, confere a fotografia e o Cliente, preserva o UUID do Plano em sua nova tabela, cria versão 1 e Rotina em rascunho pelos comandos proprietários, referencia o mesmo questionário e guarda vínculo e fotografia imutáveis. Não infere modo a partir da frequência; não altera Plano ou ocorrências legadas, nem cria OS, Visita ou tarefa Auvo. A foto conserva o tipo de tarefa legado, que não é automaticamente mapeado na Rotina nova.

A operação exige superadmin ativo, `plano.gerir`, gates de diagnóstico e execução fechados por padrão, idempotência e reconferência da origem. É preparação de rascunho, não migração concluída, aprovação do Plano, equivalência, rollback ou homologação. A concessão autenticada posterior está no ADR-1065; não abre gates. Antes de ativar, revisar segurança/FORCE RLS, lock order, autorização, colisão com Plano existente, compatibilidade dos comandos proprietários, preservação de IDs/referências/histórico, mapeamento de tipo de tarefa, reconciliação de fontes e testes concorrentes; aplicar somente em ambiente autorizado após revisão adversarial.
