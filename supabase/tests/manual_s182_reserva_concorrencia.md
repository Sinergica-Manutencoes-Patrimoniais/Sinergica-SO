# Experimento S182 — reserva e alocação

Somente em banco descartável isolado. A fixture `manual_s182_reserva_concorrencia_fixture.sql` grava dados sintéticos com prefixo `18290000`, habilita quatro gates e concede temporariamente quatro RPCs. Os registros imutáveis não devem ser removidos individualmente. Ao terminar, desligar os quatro gates e revogar os grants; descartar a base quando não for mais necessária.

Na base 55522, em 30/10/2026, foram chamadas as RPCs reais em duas sessões READ COMMITTED, mantendo a primeira transação aberta com `pg_sleep(8)`:

1. Item 031: `sso_emitir_documento_interno_parcial` reservou 6000 e confirmou; alocação concorrente de 6000 com revisão 2 retornou `saldo_reservado_documento_interno`.
2. Item 032: `sso_alocar_faturavel_documento` alocou 6000 e confirmou; emissão concorrente de 6000 com seleção na revisão 2 retornou `selecao_obsoleta`.
3. Item 031: `sso_converter_reserva_interna` converteu reserva de 6000 e confirmou; alocação concorrente de 4000 com revisão 2 retornou `revisao_divergente`.

O intervalo entre início das sessões foi inferior a 8 segundos; não houve captura de `pg_locks`, portanto a evidência não prova todas as ordens de espera ou escalonamentos. A ordem alocação primeiro contra conversão não foi reproduzida com sobreposição: a alocação de item com reserva ativa falha imediatamente. O item 033 e sua reserva sintética foram preparados para estudo adicional; não realizar novo teste após restaurar gates sem autorização e isolamento.

As quatro flags foram verificadas `false` após a rodada, e os grants temporários das quatro RPCs foram revogados. Dados sintéticos permanecem na base descartável. Nenhum serviço externo foi chamado; não inferir homologação, segurança de Storage ou cobertura de todos os escritores a partir destes casos.

## Trigger 0730 em fixture mínima — 30/10/2026

Em PostgreSQL descartável por socket local, `manual_s182_reserva_trigger_fixture.sql` criou tabelas simplificadas e aplicou a migration 0730 real. Duas sessões READ COMMITTED tentaram inserir reservas distintas para o mesmo item; a primeira manteve a transação aberta por oito segundos. Consulta a `pg_stat_activity` observou a primeira em `Timeout/PgSleep` e a segunda em `Lock/transactionid`.

- Quando a primeira confirmou, a segunda retornou `reserva_ativa_existente`; restou somente a primeira reserva.
- Com outro item, quando a primeira fez rollback, a segunda prosseguiu e confirmou; restou somente a segunda reserva. Também foi observada espera `Lock/transactionid`.

A prova exercita o trigger e o lock sobre o item, não as RPCs, RLS, permissões, regras de saldo, locks de fechamento ou todos os fluxos de negócio. A fixture simplifica os relacionamentos e não substitui ensaio com migrations completas nem revisão adversarial. Banco descartável parado ao final; nenhuma base oficial alterada.

## RPC de reserva parcial com dependências simuladas — 30/10/2026

Em PostgreSQL descartável, `manual_s182_reserva_rpc_fixture.sql` aplica as migrations 0730 e 0751 com tabelas, saldos e autorização simplificados. Duas seleções prévias do mesmo item tentaram emitir reservas parciais de 6.000 centavos em transações distintas. A segunda aguardou `Lock/transactionid`; após o commit da primeira, recebeu `reserva_ativa_existente`. Repetir o primeiro request retornou o mesmo documento e valor; alterar valor com o mesmo request retornou conflito. Uma reserva permaneceu.

Outro item foi travado numa sessão; a emissão concorrente ficou aguardando `Lock/transactionid`. A autorização simulada foi revogada e confirmada antes de liberar o item. A emissão retornou `sem_acesso` e não criou documento. Uma primeira tentativa desse cenário não tem valor como prova de revogação: o lock terminou antes da revogação; o ensaio foi repetido com espera observada e revogação confirmada durante a espera.

Não se trata de execução das migrations completas nem de prova da autorização real: `auth.uid`, `sso_autorizar_acao` e `sso_totais_alocacoes_ativas` são simulados. RLS, gate real, todos os escritores, valor alocado e cenário em que revogação começa depois da última checagem continuam sem prova. Não libera homologação.

### Revogação após a última checagem — achado reproduzido com autorização simulada

`manual_s182_revogacao_apos_checar_fixture.sql` adicionou uma barreira sintética antes da inserção do documento. Uma sessão segurou a trava; a RPC da migration 0751 ficou em `Lock/advisory` depois das verificações de autorização. Outra sessão revogou a autorização simulada e confirmou antes de liberar a barreira. A RPC ainda confirmou a reserva de 6.000 centavos. Este teste demonstra a janela quando a fonte de autorização não compartilha trava com o comando; não demonstra exploração no sistema real, porque a fonte da fixture é simulada e a barreira foi inserida artificialmente.

A função real `config.sso_autorizar_acao` lê usuário, Cliente, concessões, perfis e módulos; a migration 0319 serializa escritores dessas fontes para confirmação de Visita, mas a RPC financeira 0751 não adquire essa trava. Investigar todas as fontes/escritores reais, ordem de locks e política de revogação antes de desenhar correção aditiva; não liberar gates. O teste não prova que o lock da Visita seja solução segura para o Financeiro.

### Autorização 0246 e guarda 1086 — fixture com esquema simplificado

`manual_s182_autorizacao_real_fixture.sql` carregou a função 0246 e os triggers 0319 sobre tabelas simplificadas, com `auth.uid`/JWT fixos, usuário superadmin e concessão individual. Com a barreira sintética após a última checagem e sem 1086, revogação da concessão confirmou e `sso_autorizar_acao` passou a retornar falso, mas a RPC de reserva ainda inseriu o documento. A fonte de permissões e seus triggers foram exercitados, não o esquema completo nem outros perfis.

Após aplicar 1086 somente no banco descartável: revogação aberta primeiro causou `autorizacao_em_alteracao` na inserção e, depois do commit, `sem_acesso`; nenhuma reserva daquele pedido foi criada. No ordenamento inverso, a emissão tomou a trava compartilhada antes da barreira, a revogação ficou em `Lock/advisory` e somente confirmou depois da emissão. Também passaram autorização permitida/negada, repetição e privilégios da função no roteiro `manual_s182_autorizacao_reserva.test.sql`, com rollback. Squawk isolado: zero achados para 1086.

Faltam inventário de todos os produtores e fontes reais, autorização sem superadmin e RLS completos, interações com outras escritas financeiras, revogação de sessão e revisão adversarial. Migration e gates não foram aplicados em ambiente oficial. Ver ADR-0921.

### Liberação de reserva — guarda 1087

A RPC 0737 de liberação foi exercitada em fixture com autorização 0246/triggers 0319 e barreira sintética anterior ao insert. Sem 1087, confirmou depois que a concessão foi revogada e confirmada. Com 1087, revogação aberta primeiro causou `autorizacao_em_alteracao` sem evento; no ordenamento inverso, liberação tomou trava compartilhada e revogação esperou `Lock/advisory` até a liberação confirmar. Teste transacional `manual_s182_autorizacao_liberacao.test.sql` passou autorização, negação, replay e privilégios, com rollback; Squawk isolado sem achados.

Autorização usa usuário superadmin e esquema simplificado; não foram executadas RLS reais ou RPC de conversão. A guarda cobre somente novas linhas de liberação/conversão: replay de conversão já registrada não insere linha e continua sem essa proteção específica. Ver ADR-0922; outras operações e compatibilidade com manutenção precisam de revisão, sem liberação de gates.

### Conversão, replay e rollback — fixture simplificada

`manual_s182_conversao_fixture.sql` e `manual_s182_conversao_replay.test.sql` exercitaram as RPCs 0737/0751 e as guardas 1086/1087 em transação revertida. A primeira conversão e o replay do mesmo pedido retornaram o mesmo resultado com uma única alocação. Tentativa contra lançamento de outro Cliente falhou e não deixou evento de liberação. As tabelas e o helper de saldo são simplificados, portanto não comprovam valores agregados, RLS, concorrência ou compatibilidade com o esquema completo. O teste não cobre revogação depois da última checagem em replay e não libera o fluxo.

### Replay e revogação — guarda 1088

`manual_s182_replay_revogacao_fixture.sql` criou conversão sintética e uma view com barreira exclusivamente no banco descartável. Sem 1088, replay aguardou a barreira após checagem de autorização; revogação foi confirmada e replay ainda retornou dados, sem inserir nova alocação. Com 1088, revogação aberta primeiro causou `autorizacao_em_alteracao`; replay primeiro segurou a trava compartilhada e revogação aguardou até sua conclusão. Reexecutados os testes de conversão/replay/rollback e liberação/replay; Squawk 1088 sem achados.

O teste usa usuário superadmin, JWT fixo, tabelas e totais de saldo simulados; a view e a barreira não existem no produto. Falta teste com esquema completo, perfis, RLS, todas as fontes de permissão e análise de locks. ADR-0923 mantém gates fechados e não autoriza deploy.

### Seleção e emissão — guarda 1089

Na fixture de replay, uma view artificial bloqueou a leitura de documento. Antes da 1089, emissão parcial retornou o documento após a revogação confirmada. Com a guarda, revogação aberta primeiro fez seleção e emissão parcial retornarem `autorizacao_em_alteracao`; após o commit, a emissão retornou `sem_acesso`. Na ordem inversa, o replay aguardou a barreira mantendo a trava compartilhada e a revogação aguardou até sua conclusão. O replay retornou o documento original.

`manual_s182_autorizacao_selecao_emissao.test.sql` passou em transação revertida: replay autorizado, conflito de valor e recusa das três RPCs após revogação. Squawk não apontou problemas na 1089. O cenário usa apenas banco descartável, usuário superadmin, JWT fixo, esquema e saldo simplificados; view e barreira não são código de produção. Não comprova RLS, outras fontes de permissão, cobertura de todos os fluxos ou compatibilidade com esquema completo. ADR-0924 mantém revisão adversarial, homologação e deploy pendentes.

### Conflito entre replay integral e parcial — 1090

`manual_s182_replay_integral_conflito.test.sql` falhou antes da 1090: emissão integral retornou reserva anterior parcial de 6.000 sobre seleção de 10.000 centavos. Após 1090, o conflito foi recusado e emissão integral nova com replay idêntico retornou 10.000; autorização/replay da 1089 também passou. Squawk sem achados. Tudo em banco sintético e transação revertida, sem RLS real. Modalidade histórica não pode ser distinguida quando parcial e integral têm mesmo valor; ver ADR-0925.

### Fechamento concorrente de gate — 1091

Na mesma fixture de replay, antes da 1091 a emissão parcial ficou na barreira artificial `(182,3)` após ler gate aberto; o fechamento confirmou e ela ainda retornou o documento. Depois da 1091, fechamento iniciado primeiro bloqueou a emissão, que após commit retornou `indisponivel`. Emissão iniciada primeiro segurou os gates; fechamento aguardou e só confirmou depois de ela retornar. Observação via `pg_stat_activity`; Squawk sem achados, testes de replay integral e autorização passaram novamente. Não comprova RLS, ordem de locks com todas as demais operações nem comportamento das outras RPCs. Gates e homologação permanecem fechados; ADR-0926.
