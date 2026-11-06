# ADR-0162 — Triagem interna de integração de OS

Status: proposta, não homologada.

A consulta lê OS do Cliente e projeta somente IDs, status operacional e de sincronização, vínculo remoto e timestamp. Sem prova remota, a ausência de ID, falha e abertura em andamento são incerteza; vínculo presente é observado, não prova atualização nem execução. Notas internas exigem capacidade, revisão por timestamp e estado, têm requestId idempotente e histórico imutável. Não alteram OS nem provocam comunicação externa. Gate de reconciliação permanece fechado; funções revogadas.

IDs Auvo são projetados como texto para preservar bigint no navegador; na ausência de `updated_at`, usa-se `created_at` como referência observada. O timestamp não é fencing forte e pode não capturar mudanças de entidades associadas. Antes da ativação, reconciliar contrato e lease do fluxo proprietário, impedir conflito ABA, tratar isolamento/privacidade, retenção, concorrência e testes. Esta consulta não prova o resultado remoto nem viabiliza retry.
