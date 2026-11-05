# Aprovação e mediador do índice legado concorrentes

Usar exclusivamente clone descartável isolado com migrations até 1724. Preparar `manual_E01-S165_aprovacao_reserva_rascunho_1722.sql` até a linha anterior a `create or replace function pcm.sso_bloquear_aprovacao_impacto_indeterminado()`, incluindo os arquivos `\ir` recursivamente. Confirmar somente os dados sintéticos para permitir duas sessões. No clone, o mediador `pcm.sso_indice_legado_reservado_sso('17220000-1111-4000-8000-000000000097',0)` deve retornar `false`.

Na sessão A, iniciar transação; substituir a função da guarda 1045 por `return new` **somente nessa transação**, definir claims do ator sintético autenticado `16630000-1111-4000-8000-000000000001` e chamar `pcm.sso_aprovar_revisao_mediada` com Cliente `16630000-1111-4000-8000-00000000000a`, request `16630000-1111-4000-8000-000000000706`, revisão 3, Plano `16630000-1111-4000-8000-000000000011` e vigência `current_date+1`. Confirmar o retorno `aprovado`, mas manter a transação aberta.

Na sessão B, chamar o mediador do índice legado acima; deve receber SQLSTATE `55P03`. Reverter A e conferir que o mediador retorna `false`, não há aprovação persistida e a função da guarda original retornou. Descartar o clone.

Ensaio passou nas condições descritas. A exceção da guarda simula aprovação, sem comprovar aprovação operacional; a chamada concorrente cobre o mediador de índice, não o gerador completo nem Visita. Não executa Auvo nem cria OS.
