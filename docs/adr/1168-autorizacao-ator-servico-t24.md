---
name: "docs-adr-1168-autorizacao-ator-servico-t24-md"
description: "Documento Sinérgica SO: ADR-1168 — Autorização atual do ator para executor T−24"
alwaysApply: false
---

# ADR-1168 — Autorização atual do ator para executor T−24

Status: proposta local, não aplicada nem homologada.

Preparar consulta privada de capacidade para um ator identificado pelo recibo imutável da candidata. O serviço usa o papel atual do cadastro e as concessões, perfis, módulos e Cliente atuais; não fabrica JWT nem altera sessão. A consulta recebe o ID da tentativa e busca o ator exclusivamente no recibo do produtor, não em entrada do usuário. O resultado é somente uma precondição interna: não comprova ciência, conteúdo, contrato, exclusividade ou elegibilidade e não autoriza chamada Auvo.

A trava compartilhada deve ser coordenada com todos os escritores de permissões. Função fica sem EXECUTE; o executor ainda precisa reservar, conferir outras fontes e lidar com alteração depois do início do efeito. Validar equivalência com autorização interativa, papel alterado, revogação, RLS/FORCE, todos os escritores e revisão adversarial antes da integração.
