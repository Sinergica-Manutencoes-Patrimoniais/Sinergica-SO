# Aprovação e mediador do índice legado concorrentes

Usar exclusivamente clone descartável isolado com migrations até 1724. Preparar `manual_E01-S165_aprovacao_reserva_rascunho_1722.sql` até a linha anterior a `create or replace function pcm.sso_bloquear_aprovacao_impacto_indeterminado()`, incluindo os arquivos `\ir` recursivamente. Confirmar somente os dados sintéticos para permitir duas sessões. No clone, o mediador `pcm.sso_indice_legado_reservado_sso('17220000-1111-4000-8000-000000000097',0)` deve retornar `false`.

Na sessão A, iniciar transação; substituir a função da guarda 1045 por `return new` **somente nessa transação**, definir claims do ator sintético autenticado `16630000-1111-4000-8000-000000000001` e chamar `pcm.sso_aprovar_revisao_mediada` com Cliente `16630000-1111-4000-8000-00000000000a`, request `16630000-1111-4000-8000-000000000706`, revisão 3, Plano `16630000-1111-4000-8000-000000000011` e vigência `current_date+1`. Confirmar o retorno `aprovado`, mas manter a transação aberta.

Na sessão B, chamar o mediador do índice legado acima; deve receber SQLSTATE `55P03`. Reverter A e conferir que o mediador retorna `false`, não há aprovação persistida e a função da guarda original retornou. Descartar o clone.

Ensaio passou nas condições descritas. A exceção da guarda simula aprovação, sem comprovar aprovação operacional; a chamada concorrente cobre o mediador de índice, não o gerador completo nem Visita. Não executa Auvo nem cria OS.

## Geradores integrais

No mesmo tipo de clone, repetir a aprovação da sessão A mantendo-a aberta; a sessão B autenticada chama `pcm.materializar_ocorrencias_preventivas` para o legado sintético até `current_date+90`. O gerador deve aguardar a transação A. Reverter A e B. Em ensaio, a espera por lock foi observada em `pg_stat_activity`; após rollback de A, B terminou.

Para ensaiar concorrência após aprovação, obter previamente a definição original da função 1045 com `pg_get_functiondef`. Na transação de aprovação sintética, substituir temporariamente a função, aprovar, restaurar a definição original **antes do commit** e conferir sua igualdade após o commit. Somente no clone, simular a data civil de transição em `current_date+1` e a data civil da geração em `pcm.sso_vencimento_ciclo_calendario(current_date+11,1,'meses',1)`. Os relógios simulados exigem descartar o clone ao terminar.

Na sessão A autenticada, chamar `pcm.sso_materializar_ciclo_canonico` para a rotina do rascunho `16630000-1111-4000-8000-000000000022` agora aprovado, revisão 4, na data civil simulada; manter a transação aberta. Na sessão B, executar `pcm.materializar_ocorrencias_preventivas` para o legado `17220000-1111-4000-8000-000000000097` até a mesma data. Confirmar A; se B receber contenção, repetir após a confirmação. Conferir uma preparada SSO no ciclo e zero ocorrências legadas no índice 0 reservado a SSO.

Ensaio passou: B recebeu contenção, retry terminou e as contagens esperadas foram observadas. A aprovação e relógios foram simulados; não comprova aprovação operacional, gerador de Visita, integração externa ou todos os escritores.

## Criação de OS de outro Cliente

Em clone novo, preparar a fixture de aprovação até antes da simulação da guarda 1045. Criar Cliente, plano legado e ocorrência sintéticos de outro Cliente exclusivamente no clone; a preparação pode usar `session_replication_role=replica`, mas a escrita de OS sob teste deve usar os triggers normais. Inserir OS preventiva com `client_id`, `ocorrencia_preventiva_id`, `numero`, `titulo`, `categoria` e `created_by` válidos e manter transação aberta. Em outra sessão, simular a exceção da guarda 1045 em transação e tentar a aprovação: deve receber `55P03`. Reverter as duas transações.

Na ordem inversa, executar aprovação simulada e mantê-la aberta; inserir a OS sintética em outra sessão e observar espera por lock. Reverter aprovação e verificar que a inserção prossegue; reverter também a OS e descartar o clone.

Ambas as ordens passaram. Os Clientes eram distintos: a trava global pode aumentar latência em operações não relacionadas. Não houve avaliação de carga, aprovação operacional ou chamada Auvo.
