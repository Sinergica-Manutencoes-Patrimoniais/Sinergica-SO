---
name: "docs-adr-1055-entrada-varredura-local-md"
description: "Documento Sinérgica SO: ADR-1055 — Entrada interna da varredura local"
alwaysApply: false
---

# ADR-1055 — Entrada interna da varredura local

**Status:** preparada, desligada e não homologada. Complementa ADR-1054.

A borda aceita somente chamadas internas autenticadas com mecanismo de serviço existente, apenas POST e página limitada. O chamador informa requestId e cursor estáveis antes de enviar; resposta ausente ou erro após envio é resultado incerto e exige repetição com os mesmos parâmetros. O processo só chama a RPC de observação local, nunca o Auvo. A chave de serviço não é entregue ao navegador.

Há duas barreiras independentes: flag de ambiente desativada por padrão e gates de banco fechados. A migration concede EXECUTE da função estritamente ao papel de serviço; nenhum cron ou configuração de deploy é criado. Antes de habilitar, revisar autenticação, rotação de chave, timeout, limites, permissões, RLS/FORCE, idempotência, concorrência e auditabilidade em runtime real. O processamento não comprova estado remoto nem lease e não cobre OS, Comercial ou Financeiro.
