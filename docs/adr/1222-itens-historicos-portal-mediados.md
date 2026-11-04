# ADR-1222 — Itens públicos históricos mediados

## Decisão

Preparar consulta autenticada de itens públicos de versão operacional, reutilizando a autorização e visibilidade da proposta e o gate específico de itens. A resposta é projetada no servidor para ID, descrição, quantidade e preço público unitário; campos adicionais de dados legados não são retornados. Versão sem snapshot permanece explicitamente não estruturada.

Não retorna custos internos, não publica nem aprova proposta. Páginas e chamadas de versão/itens não são fotografia única; retiradas e revogações concorrentes exigem validação.

## Gates

Manter flag e gates fechados até ensaios de privacidade, dados antigos, RLS/FORCE, retirada, revogação, concorrência e revisão adversarial. PDF deve continuar conferindo a versão e os itens antes da entrega.
