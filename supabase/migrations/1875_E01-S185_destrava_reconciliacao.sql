-- E01-S185: abre as travas de banco da jornada de reconciliação (Auvo × Comercial × Financeiro)
-- para a rodada de exploração do cliente.
--
-- AUTORIZAÇÃO: Lucas, 25/11/2026, mesma rodada do E00-S28 (PCM) e do E00-S29 (Financeiro e
-- Comercial): "pode destravar os gates também para começarmos a explorar", com o cliente ainda
-- não operando o sistema.
--
-- O QUE ESTA MIGRATION FAZ, E SÓ ISSO
-- "update ... set habilitado = true" na única linha de cada tabela "*_gate" da story. Nenhum
-- schema muda, nenhuma função é criada ou alterada, nenhum dado de negócio é tocado. O reverso é
-- o mesmo update com "false", a qualquer momento, sem deploy de código.
--
-- FORMA DOS GATES
-- As 26 travas criadas pelas migrations desta story são todas do formato "id + habilitado"
-- (diferente do E00-S29, que tinha três gates "leitura + escrita"). A trava
-- pcm.reconciliacao_revisao_fila_gate tem ainda uma coluna "epoca", renovada por trigger a cada
-- mudança de "habilitado" — isso é o desenho: a época invalida prévias de revisão emitidas antes
-- da abertura, e é exatamente o que a concorrência otimista de AC-3 espera.
--
-- TRÊS TRAVAS FICAM FECHADAS DE PROPÓSITO (ADR-1264)
-- pcm.sso_varredura_fila_gate, pcm.sso_varredura_os_gate e pcm.sso_varredura_origens_gate guardam
-- as varreduras periódicas (pcm.sso_varrer_fila_local e afins), que ESCREVEM — criam ocorrências,
-- observações de demora e quarentenas de propriedade sem ator humano ("origem = varredura"). O
-- ADR-1264 fechou o executor periódico de propósito ("gate fechado e nenhum cron criado"), e
-- nenhuma tela da reconciliação chama essas RPCs: elas só têm grant para service_role, e as edge
-- functions integracoes-verificar/integracoes-agendar-* existem mas não têm cron registrado.
-- Abri-las não traz tela nenhuma para a exploração e passa a permitir escrita automática de
-- estado a quem tiver a service_role key. Ficam fechadas até decisão própria com ADR.
--
-- UMA DELAS NÃO É "LIGAR FEATURE" — É APERTAR GUARDA
-- pcm.reconciliacao_retry_incerto_gate: aberta, a outbox do Auvo passa a recusar a transição de
-- status 'error'/'processing' de volta para 'pending' (55000 resultado_remoto_incerto_retry_
-- bloqueado) — é a guarda de AC-3, "recuperar sem repetir efeito". Hoje nada no repositório faz
-- essa transição (nem o drain pcm-auvo-push, nem RPC alguma), então abrir é inerte na prática e
-- impede que um retry manual futuro repita um efeito remoto não confirmado. Abre junto de
-- propósito: jornada de recuperação aberta com a guarda fechada é o estado inseguro.
--
-- UMA ESCRITA NOVA NO CAMINHO QUENTE, POR DESENHO
-- pcm.reconciliacao_revisao_fila_gate aberta liga o trigger sso_revisao_fila, que passa a contar
-- revisões em pcm.reconciliacao_revisoes_fila a cada insert/update/delete da outbox (o drain roda
-- de minuto em minuto). É uma linha por item de fila, tabela própria do SO, e é o contador que
-- pcm.sso_previa_revisao_fila usa para provar que a fila não mudou entre a prévia e a solicitação
-- de recuperação. Sem ele, AC-3 não tem concorrência otimista.
--
-- O QUE NÃO VEM JUNTO
-- Concessão de capacidade não é gate: 'integracao.reconciliar', 'material.gerir',
-- 'faturavel.efetivar' e 'despesa_visita.gerir' continuam sendo concedidas por
-- config.sso_definir_concessao (Config → Capacidades). Ser superadmin NÃO dispensa concessão.
--
-- TUDO DENTRO DE UM ÚNICO "do": a GitHub Integration do Supabase roda cada statement fora de
-- transação (achado do deploy da 1842). Um bloco "do" é um statement — ou abre tudo, ou nada.
do $destrava$
declare
 v_tabela text;
 v_abertas integer := 0;
 v_nesta_linha integer;
 v_ausentes text[] := '{}';
 v_simples text[] := array[
  -- Núcleo da conferência de outbox e das projeções de Comercial/Financeiro (AC-1, AC-2)
  'pcm.reconciliacao_outbox_gate',
  'pcm.reconciliacao_revisao_fila_gate',
  'pcm.sso_origens_internas_mediadas_gate',
  'pcm.sso_eventos_origens_mediados_gate',
  -- Observação de fila e de OS, triagens e evidências (AC-1, AC-2, AC-4)
  'pcm.sso_observacao_fila_gate',
  'pcm.sso_observacao_os_gate',
  'pcm.sso_observacao_novo_cliente_gate',
  'pcm.sso_triagem_intencoes_os_gate',
  'pcm.reconciliacao_funcionario_gate',
  'pcm.reconciliacao_orfaos_admin_gate',
  'pcm.reconciliacao_os_avaliacao_gate',
  'pcm.reconciliacao_os_evidencia_gate',
  -- Recuperação sem repetir efeito (AC-3) e guarda que a protege
  'pcm.sso_solicitacao_recuperacao_gate',
  'pcm.reconciliacao_retry_incerto_gate',
  -- Conflito de propriedade e confirmação de retorno (AC-4)
  'pcm.sso_quarentena_fila_gate',
  'pcm.sso_confirmacao_retorno_fila_gate',
  'pcm.sso_confirmacao_retorno_os_gate',
  -- Conflito webhook × Chamado encerrado e sua resolução (AC-5)
  'pcm.sso_conflito_webhook_chamado_gate',
  'pcm.sso_consulta_conflitos_webhook_gate',
  'pcm.sso_resolucao_conflito_webhook_gate',
  -- Demora observada e diagnóstico/configuração do executor (AC-6, só leitura e configuração)
  'pcm.sso_config_demora_gate',
  'pcm.sso_config_executor_fila_gate',
  'pcm.sso_diagnostico_executor_admin_gate'
 ];
begin
 foreach v_tabela in array v_simples loop
  -- Tabela ausente não é erro: feature removida ou renomeada não pode derrubar a abertura das
  -- outras. Fica registrado no aviso final.
  if pg_catalog.to_regclass(v_tabela) is null then
   v_ausentes := v_ausentes || v_tabela;
   continue;
  end if;
  -- Idempotente: reaplicar não é erro, só não conta de novo (o "not habilitado" filtra).
  execute pg_catalog.format('update %s set habilitado = true where id and not habilitado', v_tabela);
  get diagnostics v_nesta_linha = row_count;
  v_abertas := v_abertas + v_nesta_linha;
 end loop;

 raise notice 'E01-S185: % trava(s) alvo, % aberta(s) nesta execução, % ausente(s): % — varredura (fila/OS/origens) permanece fechada por ADR-1264',
  array_length(v_simples, 1),
  v_abertas,
  coalesce(array_length(v_ausentes, 1), 0),
  coalesce(array_to_string(v_ausentes, ', '), 'nenhuma');
end
$destrava$;
