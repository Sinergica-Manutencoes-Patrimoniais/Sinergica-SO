# Lote isolado S165/S166 até migration 1767

Clone descartável em contêiner PostgreSQL sem rede externa; dump da base local histórica com exclusão de cron/net, grants de schemas necessários restaurados no clone e migrations 1614–1767 aplicadas em ordem. O ensaio não comprova ACL global ou equivalência a ambiente de produção.

Passaram 18 fixtures SQL: suspensão/encerramento e OS vinculada, retomada com fila, reconciliação legada de Calendário e Visita, exceção aprovada, comparação com avaliação, vínculo Visita com avaliação, avaliação tardia de Calendário, guarda de aprovação, prévia de Visita, conflito de fila Visita, conflitos de fila de Grupo, confirmação de fila, resolução de impacto, geração de Calendário, revisão de relação/lote legado e vínculo PMOC. Foram usados `ON_ERROR_STOP`, transações revertidas e dados sintéticos; gates foram habilitados apenas no clone.

Inicialmente duas fixtures antigas esperavam `40001` para conflitos que passaram a ter códigos de negócio `P0010` e `P0013` nas migrations 1743 e 1748. As expectativas foram corrigidas e as duas fixtures passaram na repetição focal.

O lote web focado executou 14 arquivos e 70 testes com sucesso, incluindo comparação, fila, exceção, reconciliação, geração e conflitos. Não é suíte completa, não executa CI remoto nem prova integrações externas. Não houve deploy ou chamada ao Auvo.
