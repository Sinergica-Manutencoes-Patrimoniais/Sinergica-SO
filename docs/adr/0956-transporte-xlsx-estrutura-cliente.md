---
name: "docs-adr-0956-transporte-xlsx-estrutura-cliente-md"
description: "Documento Sinérgica SO: ADR-0956 — Retomada local de envio XLSX de estrutura"
alwaysApply: false
---

# ADR-0956 — Retomada local de envio XLSX de estrutura

Status: transporte preparado e desconectado; não homologado.

O cliente preserva por usuário e Cliente apenas requestId, origem, aba e SHA-256, sem bytes ou token. Uma tentativa pendente somente pode ser repetida com o mesmo arquivo, origem e aba. Antes do envio e depois da resposta, confere identidade; somente remove a tentativa depois de atualizar consultas e reconferir o conteúdo armazenado. Resultado incerto mantém o pedido.

A tentativa é local à aba e pode ser perdida ao fechá-la; não coordena outros dispositivos ou usuários e não substitui reconciliação no servidor. A identidade da origem em lotes/quarentenas e o endpoint ainda exigem protocolo de recuperação antes de ativação. ADR-0936 continua impedindo conectar a entrada de arquivos de usuário antes de validação de recursos e segurança. Não publicar ou habilitar com este transporte isoladamente.
