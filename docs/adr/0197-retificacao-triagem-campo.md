# ADR-0197 — Retificação e recuperação de triagem manual

## Decisão

Preparar revisão otimista de indicação manual com justificativa, autorização global e nos Clientes anterior e novo, bloqueio do envelope e trilha append-only por requestId. Resoluções automáticas são recusadas quando houver indicação manual enquanto gate de retificação estiver ligado, evitando corrida entre as duas decisões. Consulta por requestId próprio permite recuperar o resultado de uma tentativa incerta sem mostrar payload do envelope.

## Limites

O modelo de inbox existente não possui prova canônica completa de processamento: bloqueia resolução conhecida com OS identificada, mas não comprova ausência de outros consumidores externos. Não ativar até inventariar e proteger todos os processadores e coordenar com resolução; não considerar reatribuição autorizada após processamento. Não aplicada ou testada.
