# Concorrência de escolhas futuras de Calendário

Usar exclusivamente banco descartável isolado, com migrations até 1724. Preparar a fixture em `manual_E01-S165_calendario_rascunho_1722.sql` até a linha anterior ao primeiro `do $$ declare v_rotina`, incluindo o arquivo indicado por `\ir`, e confirmar os dados sintéticos. Não executar o restante da fixture. O nome do banco deve começar com `sso_`; nunca usar banco compartilhado ou produtivo. Não alterar a guarda 1045, criar OS ou acionar Auvo.

Com duas sessões autenticadas como `16630000-1111-4000-8000-000000000001`, obter antecipadamente a mesma fotografia por `pcm.sso_prever_reserva_calendario_rascunho`: Cliente `16630000-1111-4000-8000-00000000000a`, Plano `16630000-1111-4000-8000-000000000011`, rascunho `16630000-1111-4000-8000-000000000022`, rotina obtida por `versao_id` do rascunho, índice SSO 1, legado `17220000-1111-4000-8000-000000000097`, índice legado 1 e revisão do Plano 2.

Na sessão A, iniciar transação e chamar `pcm.sso_escolher_reserva_calendario_rascunho` com esses parâmetros, revisão de escolha 0, decisão `somente_sso`, confirmação verdadeira, motivo e a fotografia. Manter transação aberta. Na sessão B, usar outro request ID e os mesmos parâmetros e fotografia: deve receber SQLSTATE `55P03`. Confirmar A e repetir B com a fotografia antiga: deve receber SQLSTATE `40001`, mensagem `fotografia_obsoleta`. Repetir o request original A: deve retornar resultado idêntico. Conferir uma única escolha persistida e descartar o banco inteiro.

Ensaio executado em clone local com migrations 1614–1724: contenção, CAS, replay e contagem passaram. Não demonstra concorrência de Visita, aprovação, Planos diferentes ou geração; guarda 1045 permaneceu intacta.
