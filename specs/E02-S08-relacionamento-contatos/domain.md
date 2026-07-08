---
name: domain
description: Linguagem ubíqua — contatos e relacionamento.
alwaysApply: false
---

# Domain — Contatos e Relacionamento

| Termo | Significado |
|---|---|
| Contato | Pessoa ou ponto de relacionamento identificado por nome e canais. |
| Identidade | Um identificador de canal: WhatsApp JID, telefone, e-mail, Instagram ID, Messenger PSID. |
| Vínculo | Relação entre contato e entidade de domínio (`pcm.clientes`, `comercial.leads`). |
| Timeline | Histórico agregado de interações e eventos relacionados ao contato. |

## Regras
- `relacionamento.contatos` não substitui `pcm.clientes` nem `comercial.leads`.
- Identidade normalizada é única por tipo.
- Conversa de atendimento aponta para `contato_id` quando o canal permitir resolver a identidade.
- Lead comercial aponta para `contato_id` quando nasce de uma conversa ou formulário identificável.
