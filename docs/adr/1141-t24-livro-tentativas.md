# ADR-1141 — Livro privado de tentativas T−24

Status: proposta local, gate fechado; não aplicada nem homologada.

Preparar livro privado por OS/Visita/revisão com estado explícito, fence monotônico, prazo de reserva e eventos append-only. No máximo uma tentativa não terminal por OS; uma reserva expirada que nunca iniciou efeito pode ser substituída por outra com fence novo. Tentativa com efeito iniciado ou incerto não retorna automaticamente à fila e exige reconciliação.

A reserva é somente trabalho candidato: não comprova autorização, identidade, janela atual, confirmação PCM nem contrato Auvo, e não autoriza rede. Ainda faltam criação transacional a partir das fontes oficiais, revalidação atômica antes do efeito, registro de resultados/fencing, mediação do executor, reconciliação, adaptação de todos os escritores legados e integração com a ADR-1140. Tabelas e funções permanecem privadas, sem concessão de execução ou job. Validar locks, concorrência, rollback, expiração, isolamento, RLS/FORCE e revisão adversarial antes de ativar.
