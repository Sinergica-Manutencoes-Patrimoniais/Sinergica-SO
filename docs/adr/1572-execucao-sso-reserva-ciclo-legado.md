# ADR 1572 — Respeitar reserva de ciclo na execução SSO

## Contexto
A escolha explícita do PCM pode reservar um ciclo específico para execução legada. Preparação da ocorrência SSO continua necessária para identificar e reconciliar a ponte; execução SSO concorrente não deve nascer enquanto a reserva exigir somente legado. Vínculos de OS existentes podem registrar proveniência legada legítima e não são nova execução.

## Decisão
Escritas que criam uma origem executável SSO — vínculo de Chamado ou nova OS de Chamado preventivo — consultam o contrato transacional privado da reserva por Cliente, Plano, preparada e modo. A conferência e sua serialização pertencem ao contrato da migration 1714; não se deduz equivalência por alvo ou data. Repetições sem nova escrita mantêm seus recibos. A preparação de ciclos e a consulta não causam efeitos; alterações comuns em OS existentes não são bloqueadas.

## Limites
A guarda não identifica automaticamente OS sem origem SSO explícita. Não altera OS, pontes, histórico, permissões ou a guarda 1045. A segurança depende do contrato de reserva cobrir aliases canônicos e serializar até a ausência de reserva; testes de concorrência e dos caminhos de Grupo/OS devem comprovar isso antes de homologação.
