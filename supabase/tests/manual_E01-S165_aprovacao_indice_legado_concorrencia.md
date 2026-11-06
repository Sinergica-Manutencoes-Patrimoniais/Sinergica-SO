---
name: "supabase-tests-manual-e01-s165-aprovacao-indice-legado-concorrencia-md"
description: "Documento Sinérgica SO: Aprovação e mediador do índice legado concorrentes"
alwaysApply: false
---

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

## Protocolo 1731 sem substituir a guarda

Em clone com migrations até 1731 e fixture de aprovação preparada, manter o gate dedicado `sso_protocolo_revisao_1731_gate` fechado e confirmar que aprovação mediada retorna `protocolo_1731_desabilitado`. Habilitar o gate exclusivamente no clone; não substituir a função da guarda 1045. Criar uma ocorrência legada sintética de outro Cliente apenas para o ensaio.

Em uma ordem, executar `pcm.atualizar_resultado_preventiva` como `service_role` e manter transação aberta: aprovação autenticada deve receber contenção. Na outra, iniciar aprovação mediada e mantê-la aberta: a RPC de resultado deve esperar e concluir após rollback da aprovação. Também tentar alterar o gate em outra sessão durante aprovação aberta: a alteração deve esperar e atingir `lock_timeout`. Reverter operações sintéticas e descartar o clone.

Os três cenários passaram com o código real da migration 1731. A aprovação foi revertida e o gate ativado somente no clone; o retorno era sintético. O ensaio não comprova homologação nem elimina a contenção global entre Clientes.

Com migrations até 1737, repetiu-se a disputa com o gerador integral `pcm.materializar_ocorrencias_preventivas` e aprovação mediada 1731 real. O gate dedicado foi habilitado somente no clone, sem substituir a guarda. Na ordem gerador primeiro, aprovação concorrente recebeu contenção; após confirmação do gerador, aprovação recusou com `impacto_parcial_pendente`. Na ordem aprovação primeiro, gerador recebeu contenção; após rollback da aprovação, o retry criou duas ocorrências sintéticas. A fixture e seu gate foram descartados; nenhuma tarefa Auvo foi criada.

## Tentativas diretas e revogação

Em clone com migrations até 1731, usar a fixture de revisão e testar como `authenticated` e `service_role`: escrita direta do gate e inserção de token devem ser recusadas; execução direta de `sso_aprovar_revisao_preparada` deve ser negada. Como `authenticated` autorizado, chamar `sso_aprovar_plano` diretamente para a revisão deve falhar com `revisao_sem_vigencia_segura`. `REPEATABLE READ` deve ser recusado pela aprovação mediada, e `authenticated` não pode configurar `session_replication_role=replica`.

Ativar o gate dedicado somente no clone. Abrir transação de revogação de `plano.gerir` e tentar aprovação em outra sessão: deve receber `autorizacao_em_alteracao`; após confirmar revogação, aprovação deve receber erro de permissão. Restaurar a concessão no clone e inverter a ordem: manter aprovação aberta e tentar revogação em outra sessão; deve ser recusada com `autorizacao_em_alteracao`. Reverter aprovação e descartar o clone.

Essas verificações passaram em clone. A transação da aprovação foi revertida; não substituem auditoria global de privilégios nem validação de todas as fontes.

Revisão estática da contenção: `sso_fotografia_os_comparacao_aprovacao` (migration 1678) chama `sso_travar_fontes_impacto_grupo` (1619), cuja trava `SHARE` inclui `pcm.ordens_servico` e tabelas de vínculo. Selos 1722/1723 e mediador 1724 acrescentam outras travas de tabela; triggers da migration 0787 ainda usam protocolo advisory global quando o gate correspondente está habilitado. Trocar apenas o lock de tabela por lock das linhas já encontradas não protege contra inserções futuras de OS ou vínculos. Uma solução granular requer protocolo comum a todos os escritores relevantes, inclusive mudanças de Cliente e dados recebidos, revisão da ordem de travas e ensaios que provem contenção no mesmo Cliente e independência entre Clientes. Não foi implementada substituição nem medida carga.

## Reserva futura de Visita com protocolo real 1731 e migrations até 1738

Em clone descartável, preparar `manual_E01-S165_visita_rascunho_aprovacao_1723.sql` até antes da substituição da guarda 1045, habilitar somente no clone o gate `sso_protocolo_revisao_1731_gate` e confirmar os dados sintéticos. Usar claims do ator `16610000-0000-0000-0000-000000000001`. Na sessão A, aprovar a revisão 3 com request terminado em 706 e vigência `current_date+1`, mantendo a transação aberta. Na B, tentar `pcm.materializar_ocorrencias_preventivas` no plano legado terminado em 930 até `date_trunc('week',current_date+14)::date+11`: recebe contenção na linha do plano legado. Reverter A.

Na ordem inversa, executar o gerador legado e manter a transação aberta: aprovação recebe `revisao_impacto_concorrente_repetir`. Reverter ambas. Por fim, confirmar o gerador e repetir aprovação: recusa `impacto_parcial_pendente`, demonstrando que o efeito tardio é reavaliado. A guarda 1045 permaneceu intacta; a aprovação de teste foi revertida. Nenhuma OS ou tarefa Auvo foi criada.

Também se tentou a preparação canônica `pcm.sso_preparar_visita_canonica` para a Visita terminada em 083. Durante aprovação aberta, recebeu contenção na linha do Plano; com revisão em rascunho, falhou com `revisao_ou_plano_indisponivel` antes de manter transação, portanto a ordem inversa do gerador canônico não foi comprovada. A prova bilateral acima cobre o gerador legado integral relacionado à reserva de Visita, não todos os geradores ou uma aprovação persistida.
