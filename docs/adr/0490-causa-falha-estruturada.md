# ADR-0490 — causa estruturada de falha de integração

Status: diagnóstico estático, não aplicado nem homologado. A definição de `pcm.auvo_sync_outbox` em 0024 contém `status`, `attempts` e `last_error` textual, sem coluna estruturada de código de falha; o código do produtor `pcm-auvo-push` registra `status='error'` e `last_error`. Não há base para classificar a causa por categoria confiável a partir desses campos.

A consulta 0689 já expõe falha e existência de detalhe sem texto bruto. A causa continua desconhecida; não se deve inferir código a partir de mensagem livre nem tratar a ausência de detalhe como ausência de efeito remoto. Para classificar futuramente, o produtor precisa registrar código estruturado validado e versão de esquema, com inventário de escritores e preservação de registros antigos como desconhecidos. Nenhuma alteração na fila, retentativa ou migration 0716 é realizada nesta etapa.
