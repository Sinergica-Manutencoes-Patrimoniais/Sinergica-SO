# Concorrência da declaração de legado inerte

Executar apenas em clone isolado descartável com migrations até 1730. Preparar `manual_E01-S165_reconciliacao_legada_inerte_1730.sql` até a linha anterior ao bloco `do $$ declare l uuid;f jsonb;r jsonb;r2 jsonb;est text`, incluindo recursivamente os arquivos indicados por `\ir`, e confirmar a preparação sintética. O selo e relógio são simulados no clone; guarda 1045 permanece intacta. Identificar a ocorrência legada de Plano `16630000-1111-4000-8000-000000000097`, índice 1, e obter fotografia autenticada com `pcm.sso_prever_reconciliacao_legada_sso`, Plano SSO `16630000-1111-4000-8000-000000000011` e escolha `17240000-1111-4000-8000-000000000031`.

Primeiro, em A, alterar `visita_em` da ocorrência e manter a transação aberta. Em B, tentar `pcm.sso_reconciliar_legada_sso` com a fotografia anterior: deve obter `55P03`. Confirmar A; repetir B deve obter `P0010` com `fotografia_obsoleta`. Obter fotografia atual e tentar novamente: deve obter `23514` com `efeito_exige_reconciliacao`.

Depois, somente no clone, restaurar `visita_em` para nulo e obter nova fotografia. Em A, registrar a declaração autenticada e manter a transação aberta. Em B, definir `lock_timeout` curto e tentar atualizar `envio_estado` para `enviando`: deve receber contenção. Confirmar A e repetir a atualização: deve receber `23514` com `indice_reservado_ao_sso`.

Ambas as ordens passaram em clone com duas sessões. Nenhum envio, OS ou chamada Auvo foi feito. O ensaio cobre `visita_em` e início de envio; não comprova todos os escritores ou aprovação operacional. Descartar o clone.

## Retorno de avaliação sintético

Em clone preparado da mesma forma, obter a fotografia antes da disputa. Na sessão A como `service_role`, iniciar transação e chamar a RPC real `pcm.upsert_avaliacoes_preventivas` com um item sintético para a ocorrência; manter transação aberta. Na sessão B autenticada, a declaração deve receber `55P03`. Confirmar A; repetir com fotografia anterior deve falhar com `P0010` e `fotografia_obsoleta`. Fotografia nova deve ser recusada com `efeito_exige_reconciliacao`.

Para ordem inversa, restaurar fixture somente no clone descartável e registrar declaração na sessão A, mantendo transação aberta. Iniciar o upsert na sessão B: observar espera por lock. Confirmar A; o upsert deve registrar a avaliação. Em seguida, `pcm.sso_indice_legado_reservado_sso` deve falhar com `efeito_legado_exige_reconciliacao`, preservando o retorno recebido e exigindo tratamento do conflito.

Os dois ensaios passaram com `service_role` e evento sintético. Não houve rede ou integração Auvo; não substituem prova dos demais caminhos de OS e retorno.

## Resultado preventivo sintético

Com a mesma preparação e fotografia, substituir o upsert de avaliação pela RPC `pcm.atualizar_resultado_preventiva(legada_id,'ok',now())`, autenticada como `service_role`. Na ordem retorno primeiro, a declaração recebeu `55P03`; após confirmação do retorno, rejeitou a fotografia antiga com `40001` e a atual com `efeito_exige_reconciliacao`. Na ordem declaração primeiro, o retorno aguardou o commit e depois foi preservado; o mediador da reserva passou a recusar com `efeito_legado_exige_reconciliacao`. Os dois ensaios passaram em clone descartável.

Em outro clone, preparou-se a fixture de aprovação sintética de `manual_E01-S165_aprovacao_reserva_rascunho_1722.sql`, com uma ocorrência adicional criada artificialmente. Um retorno em transação conteve aprovação simultânea; após o retorno ser confirmado, a aprovação simulada recusou com `impacto_parcial_pendente`. Na ordem inversa, uma aprovação simulada em transação conteve temporariamente retorno sintético de outro Cliente, que concluiu após rollback da aprovação. A exceção à guarda 1045 foi restrita à transação revertida; essa trava global pode afetar latência, sem medição de carga neste ensaio.
