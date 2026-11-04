# ADR-0988 — Identidade e autorização da aprovação parcial

Status: preparação privada, não homologada.

Preparar entrada adicional para aprovação parcial que exige ator e Cliente esperados, serializa a autorização corrente e valida o vínculo do lote antes de delegar ao comando e suas guardas existentes. Manter a entrada legada até rollout coordenado; nenhuma permissão adicional é concedida. A interface mantém o pedido incerto e verifica sessão e conteúdo antes de enviar e antes de limpar após reconsulta.

O mediador não prova todas as fontes de autorização, isolamento entre abas, atomicidade de escritores legados, integridade de campos estruturados ou reserva de códigos. Antes da ativação, revisar RLS/FORCE, ordens de locks, concorrência com revogação e alteração do lote, recuperação, privacidade de dados na aba, compatibilidade da entrada antiga e revisão adversarial. Gates fechados; sem aplicação em produção.
