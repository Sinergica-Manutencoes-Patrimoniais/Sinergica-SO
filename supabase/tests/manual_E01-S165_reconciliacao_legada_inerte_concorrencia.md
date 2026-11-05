# Concorrência da declaração de legado inerte

Executar apenas em clone isolado descartável com migrations até 1730. Preparar `manual_E01-S165_reconciliacao_legada_inerte_1730.sql` até a linha anterior ao bloco `do $$ declare l uuid;f jsonb;r jsonb;r2 jsonb;est text`, incluindo recursivamente os arquivos indicados por `\ir`, e confirmar a preparação sintética. O selo e relógio são simulados no clone; guarda 1045 permanece intacta. Identificar a ocorrência legada de Plano `16630000-1111-4000-8000-000000000097`, índice 1, e obter fotografia autenticada com `pcm.sso_prever_reconciliacao_legada_sso`, Plano SSO `16630000-1111-4000-8000-000000000011` e escolha `17240000-1111-4000-8000-000000000031`.

Primeiro, em A, alterar `visita_em` da ocorrência e manter a transação aberta. Em B, tentar `pcm.sso_reconciliar_legada_sso` com a fotografia anterior: deve obter `55P03`. Confirmar A; repetir B deve obter `40001` com `fotografia_obsoleta`. Obter fotografia atual e tentar novamente: deve obter `23514` com `efeito_exige_reconciliacao`.

Depois, somente no clone, restaurar `visita_em` para nulo e obter nova fotografia. Em A, registrar a declaração autenticada e manter a transação aberta. Em B, definir `lock_timeout` curto e tentar atualizar `envio_estado` para `enviando`: deve receber contenção. Confirmar A e repetir a atualização: deve receber `23514` com `indice_reservado_ao_sso`.

Ambas as ordens passaram em clone com duas sessões. Nenhum envio, OS ou chamada Auvo foi feito. O ensaio cobre `visita_em` e início de envio; não comprova todos os escritores ou aprovação operacional. Descartar o clone.
