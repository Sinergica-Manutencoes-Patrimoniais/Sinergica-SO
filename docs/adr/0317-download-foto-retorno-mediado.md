---
name: "docs-adr-0317-download-foto-retorno-mediado-md"
description: "Documento Sinérgica SO: ADR-0317 — Download mediado de foto de retorno"
alwaysApply: false
---

# ADR-0317 — Download mediado de foto de retorno

Status: proposta, não homologada.

Rota autenticada utiliza o handler de download existente com limite, verificação de autorização antes e depois, tamanho limitado, resposta sem cache e sem URL assinada. Resolver confronta vínculo do retorno, Cliente, OS, nota, objeto e bucket privado no momento de cada chamada. Não comprova autoria, conteúdo nem pertinência a pergunta. Caminho não é incluído no payload da interface; armazenamento direto continua bloqueado pelas políticas existentes.

Gate e EXECUTE revogados; não implantar ou ativar antes de testes de autorização, revogação, rate limit e revisão adversarial. A futura concessão do resolver deve considerar que, se disponibilizada diretamente ao usuário, sua resposta contém caminho privado; revisar mediação antes da ativação.
