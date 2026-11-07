---
name: "supabase-tests-manual-e01-s165-reserva-visita-rascunho-concorrencia-md"
description: "Documento Sinérgica SO: Concorrência de escolhas futuras de Visita"
alwaysApply: false
---

# Concorrência de escolhas futuras de Visita

Usar apenas banco descartável isolado com migrations até 1724. Em transação, executar a preparação de `manual_E01-S165_visita_rascunho_1723.sql` até a linha anterior ao primeiro `do $$ declare f jsonb;a jsonb;b jsonb;v_rot uuid;begin`, incluindo recursivamente os arquivos `\ir`. Confirmar a preparação para permitir duas sessões. Não executar o restante da fixture. Não executar em banco compartilhado ou produtivo; nenhuma OS ou tarefa Auvo deve ser criada.

Em duas sessões autenticadas como `16610000-0000-0000-0000-000000000001`, obter a mesma fotografia com `pcm.sso_prever_reserva_visita_rascunho`: Cliente `16610000-0000-0000-0000-00000000000a`, Plano `16610000-0000-0000-0000-000000000121`, rascunho `16610000-0000-0000-0000-000000000181`, rotina encontrada por `versao_id` do rascunho e `rotina_logica_id` `16610000-0000-0000-0000-000000000124`, Visita `16610000-0000-0000-0000-000000000083`, legado `16610000-0000-0000-0000-000000000930`, índice legado 0 e revisão do Plano 3.

Na sessão A, iniciar transação e chamar `pcm.sso_decidir_reserva_visita_rascunho` com os parâmetros acima, revisão de escolha 0, decisão `somente_sso`, confirmação verdadeira, motivo e fotografia. Manter transação aberta. A sessão B usa outro request ID e os mesmos parâmetros: deve receber SQLSTATE `55P03`. Após confirmar A, repetir B: deve receber SQLSTATE `40001`, mensagem `escolha_obsoleta`. Repetir o request A e comparar resultado; deve ser idêntico. Conferir uma só escolha e descartar o banco.

Ensaio em clone passou para contenção, CAS, replay e contagem. Não comprova aprovação, geração ou disputa entre Planos. Guarda 1045 permaneceu intacta.
