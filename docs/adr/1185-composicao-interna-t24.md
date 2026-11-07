---
name: "docs-adr-1185-composicao-interna-t24-md"
description: "Documento Sinérgica SO: ADR-1185 — Composição interna do executor T−24"
alwaysApply: false
---

# ADR-1185 — Composição interna do executor T−24

Status: proposta local, não homologada.

A fronteira interna compõe autenticação de serviço existente, o lote e as RPCs do schema PCM. A ligação aceita um cliente de banco e fábrica de transporte fornecidos pelo ambiente, exige gate de configuração estritamente verdadeiro e não registra endpoint, cron, credenciais ou permissões. Somente as cinco RPCs previstas no protocolo são admitidas; cada chamada tem prazo e não é repetida automaticamente. Timeout ou erro não prova rollback ou ausência de efeito externo.

O transporte Auvo, abrangência da busca e contrato remoto continuam sem comprovação. As funções SQL permanecem privadas, com gates fechados; esta composição não constitui autorização para liberar rede ou efetuar deploy. Antes de uso: testar Supabase real, identidade e rotação de credenciais, concorrência, cancelamento, resultados incertos e revisão adversarial.
