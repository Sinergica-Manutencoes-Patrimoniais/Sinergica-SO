# ADR-0376 — Unicidade e bloqueios da intenção local

Status: proposta; sem aplicação ou testes.

Uma única intenção local bloqueada é permitida por Cliente, Visita, revisão confirmada e OS, inclusive entre usuários e requests distintos; um índice parcial reforça a verificação transacional já existente. O índice falha se houver duplicados preexistentes, exigindo reconciliação e sem apagar registros. A consulta de bloqueios é uma prévia interna e nunca libera dispatch. Ainda não há revisão canônica de conteúdo da OS ligada ao comando: alteração da OS não deve ser tratada como automaticamente validada ou gerar nova intenção, e a integração futura precisa definir e verificar esse token. A outbox existente permanece intocada. Requer revisão de concorrência, política, dados legados e testes antes de ativar.
