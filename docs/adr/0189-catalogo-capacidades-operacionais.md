---
name: "docs-adr-0189-catalogo-capacidades-operacionais-md"
description: "Documento Sinérgica SO: ADR-0189 — Capacidades operacionais sem concessão automática"
alwaysApply: false
---

# ADR-0189 — Capacidades operacionais sem concessão automática

Status: proposta, não homologada.

Inventário das RPCs preparadas identificou `chamado.os.criar`, `chamado.escopo.gerir` e `chamado.continuacao.sugerir` sem cadastro. `capacidade.gerir` e `despesa_visita.gerir` já são cadastradas por migrations anteriores; a segunda, assim como `visita.cancelar`, precisava vínculo com módulo elegível para usuários não superadmin. A migration registra ações faltantes e módulo PCM escrita para as cinco ações e `visita.cancelar`, sem criar concessões ou vínculos de usuário/perfil.

Administração continua usando o fluxo existente de perfis e concessões por Cliente; ação cadastrada não autoriza automaticamente. Catálogo e rótulos não substituem revisão dos perfis reais, validação de todos os consumidores, teste de revogação/conflito e revisão de segurança. Gates das funcionalidades continuam fechados.
